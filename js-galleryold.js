// TODO fix image "recentering" when the second finger leaves after zooming

// TODO check issue when quickly click+dragging or swiping to change images faster than animation

// TODO image caching: let the browser do its thing (simply set img.src as needed)
// or do something else (maybe keeping image elements in memory avoids multiple decodings)

// TODO zooming with origin at center of double tap/pinch

// TODO kinetic panning

// TODO test if preventDefault is needed on different browsers (mouse and touch)

// TODO setup eslint

// TODO handle media other than images (<video>, <audio>)

/**
 * @typedef {{
 *  translateX?: number,
 *  translateY?: number,
 *  scale?: number
 * }} Transforms
 */

/** @enum {number} */
const State = {
  /** Showing the current image with no input */
  Idle: 0,
  /** User is dragging to change image */
  Drag: 1,
  /** User is zooming */
  Zoom: 2,
};

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
   * Current container CSS transform values
   * @type {Transforms}
   */
  _containerTransforms = {};

  /**
   * Current image CSS transform values
   * @type {Transforms}
   */
  _imageTransforms = {};

  /**
   * Current gallery state
   */
  _state = State.Idle;

  _busy = false;

  /**
   * Index of current image for container translation
   * @type {number}
   */
  _translateIndex = 0;

  /**
   * Current tracked pointer events (for gestures)
   * @type {{ [id: string]: {
   *  downEvent: PointerEvent,
   *  moveEvent: PointerEvent,
   *  containerTransforms: Transforms,
   *  imageTransforms: Transforms
   * } }}
   */
  _pointers = {};

  /** @type {PointerEvent?} */
  _lastPrimaryPointerDown = null;

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
   * @param {HTMLElement} viewportElement
   * @param {getImageUrlCallback} getImageUrlCallback
   * @param {Options} options
   */
  constructor(viewportElement, getImageUrlCallback, options) {
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
    if (this._busy)
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
    this._containerTransforms.translateX = this._translateIndex * (this._container.clientWidth / 3);
    this._containerTransforms.translateY = 0;
    this._applyTransforms(this._container, this._containerTransforms, animate);
  }

  /**
   * Translate the image container by the given pixel amounts
   * @param {number} xAmount number of pixels to translate by on the X axis
   * @param {number} yAmount number of pixels to translate by on the Y axis
   * @param {boolean} animate
   */
  // _translatePx(xAmount, yAmount, animate) {
  //   this._containerTransforms.translateX = (this._containerTransforms.translateX || 0) + xAmount;
  //   this._containerTransforms.translateY = (this._containerTransforms.translateY || 0) + yAmount;
  //   this._applyTransforms(this._container, this._containerTransforms, animate);
  // }

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
   * Apply CSS transforms to Element
   * @param {HTMLElement} element
   * @param {Transforms} transforms
   * @param {boolean} animate
   */
  _applyTransforms(element, transforms, animate) {
    element.style.transition = animate ? `transform ${this.options.transitionDuration}ms` : '';
    element.style.transform =
      `translate(${transforms.translateX || 0}px, ${transforms.translateY || 0}px) ` +
      `scale(${transforms.scale || 1})`;
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
          // Double click/tap is registered within 300ms
          if (this._state === State.Idle) {
            this._imageTransforms.scale = 2;
            this._state = State.Zoom;
          } else if (this._state === State.Zoom) {
            this._imageTransforms.scale = 1;
            this._imageTransforms.translateX = 0;
            this._imageTransforms.translateY = 0;
            this._state = State.Idle;
          }
          this._applyTransforms(this._container.children.item(1), this._imageTransforms, true);
        }
      }
      this._lastPrimaryPointerDown = ev;
    }

    this._pointers[ev.pointerId] = {
      downEvent: ev,
      moveEvent: ev,
      containerTransforms: Object.assign({}, this._containerTransforms),
      imageTransforms: Object.assign({}, this._imageTransforms)
    };
    if (Object.keys(this._pointers).length === 1) {
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

    if (Object.keys(this._pointers).length === 1) {
      if (this._state === State.Drag) {
        const delta = ev.x - this._pointers[ev.pointerId].downEvent.x;
        if (delta > 0)
          this.move('prev');
        else if (delta < 0)
          this.move('next');

        this._state = State.Idle;
      }
    } else if (Object.keys(this._pointers).length === 2) {
      // TODO
    }

    if (this._pointers[ev.pointerId])
      delete this._pointers[ev.pointerId];

    if (Object.keys(this._pointers).length === 0) {
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

    this._pointers = {};
    document.removeEventListener('pointerup', this._pointerUpHandler);
    document.removeEventListener('pointercancel', this._pointerCancelHandler);
    document.removeEventListener('pointermove', this._pointerMoveHandler);
  };

  /**
   * @param {PointerEvent} ev
   */
  _pointerMoveHandler = (ev) => {
    // console.log('pointermove', ev.pointerId, ev);
    // ev.preventDefault();

    if (Object.keys(this._pointers).length === 1) {
      if (this._state === State.Idle)
        this._state = State.Drag;

      if (this._state === State.Drag) {
        this._containerTransforms.translateX = (this._pointers[ev.pointerId].containerTransforms.translateX || 0)
          + ev.x - this._pointers[ev.pointerId].downEvent.x;
        this._applyTransforms(this._container, this._containerTransforms, false);
      } else if (this._state === State.Zoom) {
        // Calculate pixel size of contained image
        let imageWidth = 0;
        let imageHeight = 0;
        const imageAspect = this._container.children.item(1).naturalWidth / this._container.children.item(1).naturalHeight;
        const viewportAspect = this._viewport.clientWidth / this._viewport.clientHeight;
        if (imageAspect >= viewportAspect) {
          imageWidth = this._viewport.clientWidth;
          imageHeight = this._viewport.clientWidth / imageAspect;
        } else {
          imageWidth = this._viewport.clientHeight * imageAspect;
          imageHeight = this._viewport.clientHeight;
        }

        // Calculate translation limits to keep image inside the viewport
        const xMax = Math.abs((this._viewport.clientWidth - imageWidth * (this._imageTransforms.scale || 1)) / 2);
        const yMax = Math.abs((this._viewport.clientHeight - imageHeight * (this._imageTransforms.scale || 1)) / 2);

        const xDelta = (this._pointers[ev.pointerId].imageTransforms.translateX || 0)
          + ev.x - this._pointers[ev.pointerId].downEvent.x;
        this._imageTransforms.translateX = Utils.clamp(xDelta, -xMax, xMax);

        const yDelta = (this._pointers[ev.pointerId].imageTransforms.translateY || 0)
          + ev.y - this._pointers[ev.pointerId].downEvent.y;
        this._imageTransforms.translateY = Utils.clamp(yDelta, -yMax, yMax);

        // console.log('zoom', xDelta, yDelta);
        this._applyTransforms(this._container.children.item(1), this._imageTransforms, false);
      }
    } else if (Object.keys(this._pointers).length === 2) {
      if (this._state === State.Drag) {
        // User is already dragging, reset container
        this._translate('curr', true);
      }

      this._state = State.Zoom;

      const p1 = Object.values(this._pointers)[0].moveEvent;
      const p2 = Object.values(this._pointers)[1].moveEvent;
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      // console.log('move', p1.x, p1.y, p2.x, p2.y, dist);
      if (this._lastZoomDist !== 0) {
        this._imageTransforms.scale = (this._imageTransforms.scale || 1) * dist / this._lastZoomDist;
        if (this._imageTransforms.scale < 1)
          this._imageTransforms.scale = 1;
        // console.log('scale', this._lastZoomDist, dist, this._transforms.scale);
        this._applyTransforms(this._container.children.item(1), this._imageTransforms, false);
      }
      this._lastZoomDist = dist;
    }

    this._pointers[ev.pointerId].moveEvent = ev;
  };
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

  /**
   * Clamp number val to min-max range
   * @param {number} val
   * @param {number} min
   * @param {number} max
   */
  static clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }
}