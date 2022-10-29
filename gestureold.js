export class GestureDetector {

  /**
   * Max length of previous events queue
   * @constant
   */
  MAX_EVENTS = 5;

  /** @type {HTMLElement} */
  _viewport;

  /** @type {Gesture[]} */
  _gestures = [
    new TapGesture()
  ];

  /**
   * History of events for each pointer
   *
   * Key is pointerId, value is list of events in reverse chronological order (0 is most recent)
   * @private
   * @type {Map<number, PointerEvent[]>}
   */
  _pointerHistory = new Map();

  /**
   * pointerIds of currently active pointers
   * @private
   * @type {Set<number>}
   */
  _activePointers = new Set();

  /**
   * @param {HTMLElement} viewportElement
   */
  constructor(viewportElement) {
    if (!viewportElement)
      throw new Error('Invalid viewport element: ' + viewportElement);

    this._viewport = viewportElement;
    this._viewport.classList.add('js-gallery-viewport');

    // TODO keyboard events
    this._viewport.addEventListener('pointerdown', this._pointerDownHandler);
  }

  /**
   * @private
   * @param {PointerEvent} ev
   */
  _pointerDownHandler = (ev) => {
    console.log(ev);

    this._activePointers.add(ev.pointerId);

    // Register global callbacks only once
    if (this._activePointers.size === 1) {
      document.addEventListener('pointermove', this._pointerMoveHandler);
      document.addEventListener('pointerup', this._pointerUpHandler);
      document.addEventListener('pointercancel', this._pointerCancelHandler);
    }

    this._addEvent(ev);
    this._detectGestures();
  }

  /**
   * @private
   * @param {PointerEvent} ev
   */
  _pointerMoveHandler = (ev) => {
    console.log(ev);
    this._addEvent(ev);
    this._detectGestures();
  }

  /**
   * @private
   * @param {PointerEvent} ev
   */
  _pointerUpHandler = (ev) => {
    console.log(ev);

    this._activePointers.delete(ev.pointerId);

    // Unregister callbacks if no pointers are active
    if (this._activePointers.size === 0) {
      document.removeEventListener('pointermove', this._pointerMoveHandler);
      document.removeEventListener('pointerup', this._pointerUpHandler);
      document.removeEventListener('pointercancel', this._pointerCancelHandler);
    }

    this._addEvent(ev);
    this._detectGestures();
  }

  /**
   * @private
   * @param {PointerEvent} ev
   */
  _pointerCancelHandler = (ev) => {
    console.log(ev);

    this._activePointers.delete(ev.pointerId);

    // Unregister callbacks if no pointers are active
    if (this._activePointers.size === 0) {
      document.removeEventListener('pointermove', this._pointerMoveHandler);
      document.removeEventListener('pointerup', this._pointerUpHandler);
      document.removeEventListener('pointercancel', this._pointerCancelHandler);
    }
  }

  /**
   * Add event to the events history
   * @private
   * @param {PointerEvent} ev
   */
  _addEvent(ev) {
    const events = this._pointerHistory.get(ev.pointerId) || [];

    if (ev.type === 'pointermove' && events[0]?.type === 'pointermove')
      events[0] = ev; // Multiple moves are always reduced to a single history entry
    else if (events.unshift(ev) > this.MAX_EVENTS)
      events.pop();

    this._pointerHistory.set(ev.pointerId, events);
  }

  /**
   * @private
   */
  _detectGestures() {
    // TODO once a gesture is detected, should we disable further detection until all pointers have gone up?

    // console.log(this._pointerHistory);
    // console.log(this._activePointers);

    // Prepare filtered Map of only active pointers' histories
    /** @type {Map<number, PointerEvent[]>} */
    const pointers = new Map();
    for (const [pointerId, history] of this._pointerHistory.entries()) {
      if (this._activePointers.has(pointerId))
        pointers.set(pointerId, history);
    }

    // TODO call all registered Gesture.detect(), passing only histories of active pointers

    for (const gesture of this._gestures) {
      gesture.detect(pointers);

      // if (Utils.matchPatterns(this._events.get(0) || [], gesture.patterns)) {
      //   console.log(gesture.name);
      //   // TODO empty events history
      //   break;
      // }
    }
  }
}

/**
 * Abstract base class used to define a gesture
 * @abstract
 */
class Gesture {

  constructor() {
    if (this.constructor === Gesture)
      throw new TypeError("Cannot instantiate abstract class");
  }

  /**
   * Perform gesture detection logic on the given pointers
   * @abstract
   * @param {Map<number, PointerEvent[]>} pointers List of active pointers with history
   * @returns {boolean} Whether the gesture was detected
   */
  detect(pointers) {
    throw new TypeError("Abstract method must be implemented in inherited class");
  }
}

class TapGesture extends Gesture {
  detect(pointers) {
    console.log(pointers);
    return false;
  }
}

// class GesturePattern {

//   /**
//    * Object with any properties from PointerEvent, whose values will be matched against
//    * @type {{[property in keyof PointerEvent]?: any}}
//    */
//   pattern;

//   /**
//    * Time difference in milliseconds from the previous event (optional)
//    * @type {number | undefined}
//    */
//   timeDelta; // TODO also specify from which previous event type to calculate delta

//   /**
//    * @param {{[property in keyof PointerEvent]?: any}} pattern
//    */
//   constructor(pattern) {
//     this.pattern = pattern;
//   }
// }

// class Utils {

//   /**
//    * @param {PointerEvent} event Event to check
//    * @param {GesturePattern} pattern Event properties to match against
//    * @returns {boolean} Whether ev matches the values specified in pattern
//    */
//   static matchPattern(event, pattern) {
//     for (const [property, value] of Object.entries(pattern.pattern)) {
//       // @ts-ignore
//       if (event[property] !== value)
//         return false;
//     }

//     return true;
//   }

//   /**
//    * @param {PointerEvent[]} events List of events to check
//    * @param {GesturePattern[]} patterns List of patterns to match against in the specified order
//    * @returns {boolean} Whether all events match their respective pattern
//    */
//   static matchPatterns(events, patterns) {
//     if (events.length < patterns.length)
//       return false;

//     let i = 0;
//     for (const pat of patterns) {
//       if (!this.matchPattern(events[i], pat))
//         return false;
//       // TODO match time deltas
//       i++;
//     }

//     return true;
//   }
// }
