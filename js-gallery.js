// TODO image caching: let the browser do its thing (simply set img.src as needed)
// or do something else (maybe keeping image elements in memory avoids multiple decodings)

// TODO zooming with origin at center of double tap/pinch

// TODO kinetic panning

// TODO test if preventDefault is needed on different browsers (mouse and touch)

// TODO setup eslint

// TODO handle media other than images (<video>, <audio>)

/**
 * @typedef {{
 *  translateX: number,
 *  translateY: number,
 *  scale: number
 * }} Transforms
 */

/**
 * Called when an action completes
 * @callback CompleteFn
 * @param {boolean} canceled `true` if the action was aborted
 * @returns {void}
 */

/**
 * Called to retrieve an image URL, based on the current relative index
 * @callback GetImageUrlFn
 * @param {number} index relative index of requested image
 * @returns {string} URL; falsy value indicates no image to display
 */

/** @enum {number} */
const State = {
  Move: 1,
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

  /** @type {GetImageUrlFn} */
  _getImageUrlFn;

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

  /** @type {GalleryContainer} */
  _container;

  /**
   * Current gallery state
   */
  _state = State.Move;

  _busy = false;

  /**
   * Current tracked pointers events (for gestures)
   * @type {{ [id: string]: {
   *  downEvent: PointerEvent,
   *  moveEvent: PointerEvent,
   *  transforms: any,
   * } }}
   */
  _pointers = {};

  /** @type {PointerEvent?} */
  _lastPointerUp = null;

  _lastZoomDist = 0;

  /**
   * @param {HTMLElement} viewport
   * @param {GetImageUrlFn} getImageUrlFn
   * @param {Options} options
   */
  constructor(viewport, getImageUrlFn, options) {
    if (!viewport)
      throw new Error('Invalid viewport element: ' + viewport);
    if (!getImageUrlFn)
      throw new Error('Invalid getImageUrlFn: ' + getImageUrlFn);

    if (options)
      Object.assign(this.options, options);

    this._getImageUrlFn = getImageUrlFn;

    viewport.classList.add('js-gallery-viewport');
    viewport.tabIndex = -1; // Make the viewport focusable to listen for keyboard events
    this._viewport = viewport;

    this._container = new GalleryContainer(this._viewport);
    this._container.setImageUrl(-1, this._getImageUrlFn(-1));
    this._container.setImageUrl(0, this._getImageUrlFn(0));
    this._container.setImageUrl(+1, this._getImageUrlFn(+1));

    this._viewport.addEventListener('keydown', (ev) => {
      let dir = 0;
      if (ev.key === 'ArrowLeft')
        dir = -1;
      else if (ev.key === 'ArrowRight')
        dir = +1;

      if (dir !== 0 && !this._busy) {
        this._busy = true;
        this._container.slide(dir, this._getImageUrlFn(this.imageIndex + (dir * 2)),
          (canceled) => {
            if (!canceled)
              this.imageIndex += dir;
            this._busy = false;
          });
      }
    });
    // this._viewport.addEventListener('pointerdown', this._pointerDownHandler);
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
          if (this._state === State.Move) {
            this._transforms.image.scale = 2;
            this._state = State.Zoom;
          } else if (this._state === State.Zoom) {
            this._transforms.image.scale = 1;
            this._transforms.image.translate.x = 0;
            this._transforms.image.translate.y = 0;
            this._state = State.Move;
          }
          this._transforms.image.animate = true;
          this._applyTransforms();
        }
      }
      this._lastPrimaryPointerDown = ev;
    }

    this._pointers[ev.pointerId] = {
      downEvent: ev,
      moveEvent: ev,
      transforms: Utils.clone(this._transforms),
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
      if (this._state === State.Move) {
        const delta = ev.x - this._pointers[ev.pointerId].downEvent.x;
        if (delta > 0)
          this.move('prev');
        else if (delta < 0)
          this.move('next');
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
      if (this._state === State.Move) {
        // TODO saving containerTransforms breaks when swiping quickly
        this._transforms.container.translate.x = (this._pointers[ev.pointerId].transforms.container.translate.x || 0)
          + ev.x - this._pointers[ev.pointerId].downEvent.x;
        this._transforms.image.animate = true;
        this._applyTransforms();
      } else if (this._state === State.Zoom) {
        // TODO move outside handler and update on viewport resize
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
        const xMax = Math.abs((this._viewport.clientWidth - imageWidth * (this._transforms.image.scale || 1)) / 2);
        const yMax = Math.abs((this._viewport.clientHeight - imageHeight * (this._transforms.image.scale || 1)) / 2);

        // TODO transforms clone is probably shallow
        const xDelta = (this._pointers[ev.pointerId].transforms.image.translate.x || 0)
          + ev.x - this._pointers[ev.pointerId].downEvent.x;
        this._transforms.image.translate.x = Utils.clamp(xDelta, -xMax, xMax);

        const yDelta = (this._pointers[ev.pointerId].transforms.image.translate.y || 0)
          + ev.y - this._pointers[ev.pointerId].downEvent.y;
        this._transforms.image.translate.y = Utils.clamp(yDelta, -yMax, yMax);

        // console.log('zoom', xDelta, yDelta);
        this._transforms.image.animate = false;
        this._applyTransforms();
      }
    } else if (Object.keys(this._pointers).length === 2) {
      this._state = State.Zoom;

      const p1 = Object.values(this._pointers)[0].moveEvent;
      const p2 = Object.values(this._pointers)[1].moveEvent;
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      // console.log('move', p1.x, p1.y, p2.x, p2.y, dist);
      if (this._lastZoomDist !== 0) {
        this._transforms.image.scale = (this._transforms.image.scale || 1) * dist / this._lastZoomDist;
        if (this._transforms.image.scale < 1)
          this._transforms.image.scale = 1;
        this._transforms.image.animate = false;
        // console.log('scale', this._lastZoomDist, dist, this._transforms.scale);
        this._applyTransforms();
      }
      this._lastZoomDist = dist;
    }

    this._pointers[ev.pointerId].moveEvent = ev;
  };
}

class GalleryElement {

  /** @type {HTMLElement} */
  element;

  /** @type {Transforms} */
  transforms;

  /**
   * Called once when next transition ends or is canceled
   * @protected @type {CompleteFn?} 
   */
  _transitionCompleteFn = null;

  /** @param {HTMLElement} element */
  constructor(element) {
    this.element = element;
    this.transforms = {
      translateX: 0,
      translateY: 0,
      scale: 1
    };
    this.element.addEventListener('transitionstart', ev => {
      // console.log(ev);
    });
    this.element.addEventListener('transitionend', ev => {
      // console.log(ev);
      if (this._transitionCompleteFn) {
        this._transitionCompleteFn(false);
        this._transitionCompleteFn = null;
      }
    });
    this.element.addEventListener('transitioncancel', ev => {
      // console.log(ev);
      if (this._transitionCompleteFn) {
        this._transitionCompleteFn(true);
        this._transitionCompleteFn = null;
      }
    });
  }

  /** @param {boolean} transition */
  applyTransforms(transition) {
    // console.log(this.transforms);
    this.element.style.transition = transition ? `transform 250ms` : '';
    this.element.style.transform =
      `translate(${this.transforms.translateX || 0}px, ${this.transforms.translateY || 0}px) ` +
      `scale(${this.transforms.scale || 1})`;
  }
}

class GalleryContainer extends GalleryElement {

  /** @private @type {GalleryImage[]} */
  _images;

  /** @param {HTMLElement} parent */
  constructor(parent) {
    super(document.createElement('div'));
    this.element.classList.add('js-gallery-container');
    parent.append(this.element);

    this._images = [
      new GalleryImage(''),
      new GalleryImage(''),
      new GalleryImage(''),
    ];
    this.element.append(...this._images.map(i => i.element));

    this.transforms.translateX = -1 * (this.element.clientWidth / 3);
    this.transforms.translateY = 0;
    this.applyTransforms(false);
  }

  /**
   * @param {number} index previous: `-1`, current: `0`, next: `+1`
   * @param {string} url
   */
  setImageUrl(index, url) {
    this._images[index + 1].setUrl(url);
  }

  /**
   * @param {number} index previous: `-1`, next: `+1`
   * @param {string} newUrl url of image to preload
   * @param {CompleteFn} completeFn called when the slide finishes
   */
  slide(index, newUrl, completeFn) {
    if (index === -1) {
      if (this._images[0].isEmpty) {
        // TODO reset to current image for gestures
        completeFn(true);
        return;
      }

      this.transforms.translateX = 0;
      this.transforms.translateY = 0;
      this.applyTransforms(true);

      this._transitionCompleteFn = (/** @type {boolean} */ canceled) => {
        this._images.unshift(new GalleryImage(newUrl));
        this.element.prepend(this._images[0].element);

        this.transforms.translateX = -1 * (this.element.clientWidth / 3);
        this.transforms.translateY = 0;
        this.applyTransforms(false);

        this._images.pop();
        // @ts-ignore
        this.element.removeChild(this.element.lastElementChild);

        completeFn(canceled);
      };
    } else if (index === +1) {
      if (this._images[2].isEmpty) {
        // TODO reset to current image for gestures
        completeFn(true);
        return;
      }

      this.transforms.translateX = -2 * (this.element.clientWidth / 3);
      this.transforms.translateY = 0;
      this.applyTransforms(true);

      this._transitionCompleteFn = (/** @type {boolean} */ canceled) => {
        this._images.shift();
        // @ts-ignore
        this.element.removeChild(this.element.firstElementChild);

        this.transforms.translateX = -1 * (this.element.clientWidth / 3);
        this.transforms.translateY = 0;
        this.applyTransforms(false);

        this._images.push(new GalleryImage(newUrl));
        this.element.append(this._images[2].element);

        completeFn(canceled);
      };
    } else
      throw new Error(`Invalid index '${index}'`);
  }
}

class GalleryImage extends GalleryElement {

  isEmpty = true;

  /** @param {string} url */
  constructor(url) {
    super(new Image());
    /** @type {HTMLImageElement} */ this.element;
    this.setUrl(url);
  }

  /** @param {string} url */
  setUrl(url) {
    if (url) {
      this.element.src = url;
      this.isEmpty = false;
      this.element.style.visibility = '';
    } else {
      this.element.src = '';
      this.isEmpty = true;
      this.element.style.visibility = 'hidden';
    }
  }
}

class Utils {
  /**
   * Clamp number val to min-max range
   * @param {number} val
   * @param {number} min
   * @param {number} max
   */
  static clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /**
   * Deep clone a simple object
   * @param {object} obj
   */
  static clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}