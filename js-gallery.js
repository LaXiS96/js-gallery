// TODO image caching: let the browser do its thing (simply set img.src as needed)
// or do something else (maybe keeping image elements in memory avoids multiple decodings)

// TODO zooming with origin at center of double tap/pinch

// TODO kinetic panning

// TODO test if preventDefault is needed on different browsers (mouse and touch)

// TODO setup eslint

// TODO handle media other than images (<video>, <audio>)

export class Options {
  /**
   * Duration of transitions in milliseconds
   * @type {number}
   */
  transitionDuration = 250;

  // TODO
  /**
   * Minimum pixel variation to register a move
   * @type {number}
   */
  minMoveDelta = 0;
}

export class Gallery {

  /** @type {Options} */
  options = new Options;

  /**
   * Index of the current image, relative to the first image (indexed at 0):
   * previous images have negative index, next images have positive index
   * @type {number}
   */
  imageIndex = 0;

  /** @type {HTMLElement} */
  _viewport;

  /** @type {HTMLDivElement} */
  _container;

  /**
   * Current CSS transform values
   */
  _transforms = {
    translate: { x: 0, y: 0 },
    scale: 1
  };

  _state = StateEnum.Idle;

  /**
   * Index of current image for container translation
   * @type {number}
   */
  _translateIndex = 0;

  /**
   * Current tracked pointer down events (for gestures)
   * @type {PointerEvent[]}
   */
  _pointerDownEvents = [];

  /**
   * Current tracked pointer move events (for gestures)
   * @type {PointerEvent[]}
   */
  _pointerMoveEvents = [];

  /** @type {PointerEvent} */
  _lastPrimaryPointerDown;

  _lastZoomDist = 0;

  /**
   * Callback for retrieving the image URL based on the relative index
   * @callback getImageUrlCallback
   * @param {number} index relative index of requested image
   * @returns {string} URL; falsy value indicates no image to display
   */

  /**
   * @type {getImageUrlCallback}
   */
  _callback;

  /**
   * Initialize gallery
   * @param {HTMLElement} viewportElement
   * @param {getImageUrlCallback} getImageUrlCallback
   * @param {Options} options
   */
  init(viewportElement, getImageUrlCallback, options) {
    if (!viewportElement)
      throw new Error('Invalid viewport element: ' + viewportElement);
    if (!getImageUrlCallback)
      throw new Error('Invalid getImageUrlCallback: ' + getImageUrlCallback);

    if (options)
      Object.assign(this.options, options);

    this._callback = getImageUrlCallback;

    this._viewport = viewportElement;
    this._viewport.classList.add('js-gallery-viewport');
    this._viewport.tabIndex = -1; // Make the viewport focusable to listen for keyboard events

    this._container = document.createElement('div');
    this._container.classList.add('js-gallery-container');

    // Container must always contain 3 images
    this._container.append(
      Utils.newImage(this._getImageUrl('prev')),
      Utils.newImage(this._getImageUrl('curr')),
      Utils.newImage(this._getImageUrl('next'))
    );
    this._viewport.append(this._container);

    // Start from the middle image
    this._translate('next', false);

    this._viewport.addEventListener('keydown', (ev) => {
      switch (ev.key) {
        case 'ArrowLeft':
          // ev.preventDefault();
          this.move('prev');
          break;
        case 'ArrowRight':
          // ev.preventDefault();
          this.move('next');
          break;
      }
    });
    this._viewport.addEventListener('pointerdown', this._pointerDownHandler);
  }

  /**
   * Move viewport to previous/next image
   * @param {'prev'|'next'} direction
   */
  move(direction) {
    if (this._busy) // TODO replace _busy with _state
      return;

    if (direction === 'prev') {
      this._busy = true;

      // Do not move if there is no image to show
      if (!this._container.firstElementChild.src) {
        this._translate('curr', true); // Reset any pointer moves
        setTimeout(() => {
          this._busy = false;
        }, this.options.transitionDuration);
        return;
      }

      this.imageIndex--;
      this._container.removeChild(this._container.lastElementChild);
      this._translate('prev', true);
      setTimeout(() => {
        this._container.prepend(Utils.newImage(this._getImageUrl(direction)));
        this._translate('next', false);
        this._busy = false;
      }, this.options.transitionDuration);
    } else if (direction === 'next') {
      this._busy = true;

      // Do not move if there is no image to show
      if (!this._container.lastElementChild.src) {
        this._translate('curr', true); // Reset any pointer moves
        setTimeout(() => {
          this._busy = false;
        }, this.options.transitionDuration);
        return;
      }

      this.imageIndex++;
      this._container.append(Utils.newImage(this._getImageUrl(direction)));
      this._translate('next', true);
      setTimeout(() => {
        this._container.removeChild(this._container.firstElementChild);
        this._translate('prev', false);
        this._busy = false;
      }, this.options.transitionDuration);
    } else
      throw new Error(`Invalid direction '${direction}'`);
  }

  /**
   * Translate the image container horizontally, snapping to image boundaries
   * @param {'prev'|'curr'|'next'} direction
   * @param {boolean} animate
   */
  _translate(direction, animate) {
    this._translateIndex += direction === 'next' ? -1 : direction === 'prev' ? +1 : 0;
    this._transforms.translate.x = this._translateIndex * (this._container.clientWidth / 3);
    this._transforms.translate.y = 0;
    this._applyTransforms(animate);
  }

  /**
   * Translate the image container by the given pixel amounts
   * @param {number} xAmount number of pixels to translate by on the X axis
   * @param {number} yAmount number of pixels to translate by on the Y axis
   * @param {boolean} animate
   */
  _translatePx(xAmount, yAmount, animate) {
    this._transforms.translate.x += xAmount;
    this._transforms.translate.y += yAmount;
    this._applyTransforms(animate);
  }

  /**
   * Get previous/current/next image to display
   * @param {'prev'|'curr'|'next'} direction
   * @returns {string} URL
   */
  _getImageUrl(direction) {
    const i = this.imageIndex + (direction === 'next' ? +1 : direction === 'prev' ? -1 : 0);
    return this._callback(i);
  }

  /**
   * Apply CSS transforms as specified in `_transforms`
   * @param {boolean} animate whether to animate the transition
   */
  _applyTransforms(animate) {
    this._container.style.transition = animate ? `transform ${this.options.transitionDuration}ms` : '';
    this._container.style.transform =
      `translate(${this._transforms.translate.x || 0}px, ${this._transforms.translate.y || 0}px) ` +
      `scale(${this._transforms.scale || 1})`;
  }

  /**
   * @remarks Adds event listeners on `document` for subsequent events
   * @param {PointerEvent} ev
   */
  _pointerDownHandler = (ev) => {
    // console.log(ev.pointerId, ev);

    // Calling preventDefault on Firefox 89 Android breaks pointermove with multiple touch inputs
    if (ev.pointerType !== 'touch')
      ev.preventDefault();

    this._viewport.focus(); // For keyboard events
    if (ev.isPrimary) {
      if (this._lastPrimaryPointerDown) {
        const d = ev.timeStamp - this._lastPrimaryPointerDown.timeStamp;
        if (d <= 300) {
          if (this._state === StateEnum.Idle) {
            this._transforms.scale = 2;
            this._state = StateEnum.Zoom;
          } else if (this._state === StateEnum.Zoom) {
            this._transforms.scale = 1;
            this._state = StateEnum.Idle;
          }

          this._applyTransforms(true);
          this._translate('curr', true);
        }
      }
      this._lastPrimaryPointerDown = ev;
    }

    this._pointerDownEvents.push(ev);
    this._pointerMoveEvents.push(ev);
    if (this._pointerDownEvents.length === 1) {
      document.addEventListener('pointerup', this._pointerUpHandler);
      document.addEventListener('pointercancel', this._pointerCancelHandler);
      document.addEventListener('pointermove', this._pointerMoveHandler);
    }
  };

  /**
   * @param {PointerEvent} ev
   */
  _pointerUpHandler = (ev) => {
    // console.log(ev.pointerId, ev);
    // ev.preventDefault();

    // TODO should check pointerId?

    if (this._pointerDownEvents.length === 1) {
      if (this._state === StateEnum.Idle) {
        const delta = ev.x - this._pointerDownEvents[0].x;
        if (delta > 0)
          this.move('prev');
        else if (delta < 0)
          this.move('next');
      }
    } else if (this._pointerDownEvents.length === 2) {
      // TODO
    }

    let i = this._pointerDownEvents.findIndex(e => e.pointerId === ev.pointerId);
    if (i !== -1)
      this._pointerDownEvents.splice(i, 1);

    i = this._pointerMoveEvents.findIndex(e => e.pointerId === ev.pointerId);
    if (i !== -1)
      this._pointerMoveEvents.splice(i, 1);

    if (this._pointerDownEvents.length === 0) {
      document.removeEventListener('pointerup', this._pointerUpHandler);
      document.removeEventListener('pointercancel', this._pointerCancelHandler);
      document.removeEventListener('pointermove', this._pointerMoveHandler);
      this._lastZoomDist = 0;
    }
  };

  /**
   * @param {PointerEvent} ev
   */
  _pointerCancelHandler = (ev) => {
    // console.log(ev.pointerId, ev);
    // ev.preventDefault();

    document.removeEventListener('pointerup', this._pointerUpHandler);
    document.removeEventListener('pointercancel', this._pointerCancelHandler);
    document.removeEventListener('pointermove', this._pointerMoveHandler);

    this._pointerDownEvents = [];
    this._pointerMoveEvents = [];
  };

  /**
   * @param {PointerEvent} ev
   */
  _pointerMoveHandler = (ev) => {
    // console.log('pointerId', ev.pointerId, '_pointerMoveEvents.length', this._pointerMoveEvents.length, ev.pointerType);
    // ev.preventDefault();

    // console.log('_pointerMoveEvents', this._pointerMoveEvents.length);
    if (this._pointerMoveEvents.length === 1) {
      if (this._state === StateEnum.Idle) {
        this._translatePx(ev.x - this._pointerMoveEvents[0].x, 0, false);
      } else if (this._state === StateEnum.Zoom) {
        // TODO pan within current image bounds (remember: CSS scale does not change px values)
        this._translatePx(ev.x - this._pointerMoveEvents[0].x, ev.y - this._pointerMoveEvents[0].y, false);
      }
    } else if (this._pointerMoveEvents.length === 2) {
      this._state = StateEnum.Zoom;

      const p1 = this._pointerMoveEvents[0];
      const p2 = this._pointerMoveEvents[1];
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      // console.log('move', p1.x, p1.y, p2.x, p2.y, dist);
      if (this._lastZoomDist !== 0) {
        this._transforms.scale *= dist / this._lastZoomDist;
        if (this._transforms.scale < 1)
          this._transforms.scale = 1;
        // console.log('scale', this._lastZoomDist, dist, this._transforms.scale);
        this._applyTransforms(false);
      }
      this._lastZoomDist = dist;
    }

    const i = this._pointerMoveEvents.findIndex(e => e.pointerId === ev.pointerId);
    if (i !== -1)
      this._pointerMoveEvents[i] = ev;
    else
      this._pointerMoveEvents.push(ev);
  };
}

class StateEnum {
  static Idle = new StateEnum('idle', 1);
  static Zoom = new StateEnum('zoom', 2);

  // TODO order

  /**
   * @param {string} name
   * @param {number} order
   */
  constructor(name, order) {
    this.name = name;
    this.order = order;
  }
}

class Utils {
  /**
   * Create a new HTMLImageElement for the given URL
   * @param {string} url
   * @returns {HTMLImageElement}
   */
  static newImage(url) {
    const img = new Image();
    if (url)
      img.src = url;
    else
      img.style.visibility = 'hidden';
    return img;
  }
}