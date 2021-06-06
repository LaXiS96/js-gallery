// TODO image caching: let the browser do its thing (simply set img.src as needed)
// or do something else (maybe keeping image elements in memory avoids multiple decodings)

// TODO handle zooming and panning within the current image (needs double tap to enter/exit zoom)

// TODO handle videos

class GalleryOptions {
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

class Gallery {
  options = new GalleryOptions;

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
   * Index of current image for container translation
   * @type {number}
   */
  _translateIndex = 0;

  /**
   * Current container translation amount in pixels
   * @type {number}
   */
  _translateValue = 0;

  /**
   * Whether a move is in progress
   * @type {boolean}
   */
  _busy = false; // TODO is there a semaphore primitive?

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

  /**
   * @type {'idle'|'scroll'|'zoom1'|'zoom2'}
   */
  _gestureState = 'idle';

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
   * @param {GalleryOptions} options
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
      this._newImage(this._getImageUrl('prev')),
      this._newImage(this._getImageUrl('curr')),
      this._newImage(this._getImageUrl('next'))
    );
    this._viewport.append(this._container);

    // Start from the middle image
    this._translate('next', false);

    this._viewport.addEventListener('keydown', (ev) => {
      switch (ev.key) {
        case 'ArrowLeft':
          ev.preventDefault();
          ev.stopPropagation();
          this.move('prev');
          break;
        case 'ArrowRight':
          ev.preventDefault();
          ev.stopPropagation();
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
        this._container.prepend(this._newImage(this._getImageUrl(direction)));
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
      this._container.append(this._newImage(this._getImageUrl(direction)));
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
   * @param {boolean} animate whether to animate the translation
   */
  _translate(direction, animate) {
    this._container.style.transition = animate ? 'transform ' + this.options.transitionDuration + 'ms' : '';
    this._translateIndex += direction === 'next' ? -1 : direction === 'prev' ? +1 : 0;
    this._translateValue = this._translateIndex * (this._container.clientWidth / 3);
    this._container.style.transform = this._setStyle(this._container.style.transform,
      'translateX', this._translateValue.toString() + 'px');
  }

  /**
   * Translate the image container horizontally by the given amount
   * @param {number} amount number of pixels to translate by
   */
  _translatePx(amount) {
    this._container.style.transition = '';
    // TODO boundary checks? maybe not needed since we always move by one image only
    this._translateValue += amount;
    this._container.style.transform = this._setStyle(this._container.style.transform,
      'translateX', this._translateValue.toString() + 'px');
  }

  /**
   * Get previous/current/next image to display
   * @param {'prev'|'curr'|'next'} direction
   * @returns {string} URL
   */
  _getImageUrl(direction) {
    // var i = this.imageIndex + (direction === 'next' ? +1 : direction === 'prev' ? -1 : 0);
    // return this._callback(i);
    // return 'https://placeimg.com/320/240/any?' + Math.random();
    return 'image.jpg';
  }

  /**
   * Create a new HTMLImageElement for the given URL
   * @param {string} url
   * @returns {HTMLImageElement}
   */
  _newImage(url) {
    var img = new Image();
    if (url)
      img.src = url;
    else
      img.style.visibility = 'hidden';
    return img;
  }

  /**
   * @param {string} source
   * @param {string} cssFunction
   * @param {string} cssValue
   */
  _setStyle(source, cssFunction, cssValue) {
    var re = new RegExp(cssFunction + '\\(.*?\\)', 'i');
    if (re.test(source))
      var r = source.replace(re, cssFunction + '(' + cssValue + ')');
    else
      var r = source + ' ' + cssFunction + '(' + cssValue + ')';
    return r;
  }

  /**
   * @remarks Adds event listeners on `document` for subsequent events
   * @param {PointerEvent} ev
   */
  _pointerDownHandler = (ev) => {
    console.log(ev.pointerId, ev);
    ev.preventDefault();
    ev.stopPropagation();

    this._viewport.focus(); // For keyboard events
    if (ev.isPrimary) {
      if (this._lastPrimaryPointerDown) {
        var d = ev.timeStamp - this._lastPrimaryPointerDown.timeStamp;
        if (d <= 300) {
          this._container.style.transform = this._setStyle(this._container.style.transform, 'scale', '2');
        }
      }
      this._lastPrimaryPointerDown = ev;
    }

    this._pointerDownEvents.push(ev);
    this._pointerMoveEvents.push(ev);
    if (this._pointerDownEvents.length === 1) {
      console.log('addEventListener');
      document.addEventListener('pointerup', this._pointerUpHandler);
      document.addEventListener('pointercancel', this._pointerCancelHandler);
      document.addEventListener('pointermove', this._pointerMoveHandler);
    }
  };

  /**
   * @param {PointerEvent} ev
   */
  _pointerUpHandler = (ev) => {
    console.log(ev.pointerId, ev);
    ev.preventDefault();
    ev.stopPropagation();

    // TODO should check pointerId?

    if (this._pointerDownEvents.length === 1) {
      var delta = ev.x - this._pointerDownEvents[0].x;
      if (delta > 0)
        this.move('prev');
      else if (delta < 0)
        this.move('next');
    } else if (this._pointerDownEvents.length === 2) {
      // TODO
    }

    var i = this._pointerDownEvents.findIndex(e => e.pointerId === ev.pointerId);
    if (i !== -1)
      this._pointerDownEvents.splice(i, 1);

    i = this._pointerMoveEvents.findIndex(e => e.pointerId === ev.pointerId);
    if (i !== -1)
      this._pointerMoveEvents.splice(i, 1);

    if (this._pointerDownEvents.length === 0) {
      console.log('removeEventListener');
      document.removeEventListener('pointerup', this._pointerUpHandler);
      document.removeEventListener('pointercancel', this._pointerCancelHandler);
      document.removeEventListener('pointermove', this._pointerMoveHandler);
    }
  };

  /**
   * @param {PointerEvent} ev
   */
  _pointerCancelHandler = (ev) => {
    console.log(ev.pointerId, ev);
    ev.preventDefault();
    ev.stopPropagation();

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
    console.log(ev.pointerId, this._pointerMoveEvents.length, ev);
    ev.preventDefault();
    ev.stopPropagation();

    // console.log('_pointerMoveEvents', this._pointerMoveEvents.length);
    if (this._pointerMoveEvents.length === 1) {
      this._translatePx(ev.x - this._pointerMoveEvents[0].x);
    } else if (this._pointerMoveEvents.length === 2) {
      const p1 = this._pointerMoveEvents[0];
      const p2 = this._pointerMoveEvents[1];
      var dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      // console.log('move', p1.x, p1.y, p2.x, p2.y, dist);
      // TODO CSS scale
    }

    var i = this._pointerMoveEvents.findIndex(e => e.pointerId === ev.pointerId);
    if (i !== -1)
      this._pointerMoveEvents[i] = ev;
    else
      this._pointerMoveEvents.push(ev);
  };
}