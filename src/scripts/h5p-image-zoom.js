import Util from './h5p-image-zoom-util';

// TODO: A11Y
// TODO: Clean up
// TODO: Mobile support: not requested, left to pinch zooming

export default class ImageZoom extends H5P.EventDispatcher {
  /**
   * @constructor
   *
   * @param {object} params Parameters passed by the editor.
   * @param {number} contentId Content's id.
   */
  constructor(params, contentId) {
    super();

    // Set defaults
    this.params = Util.extend({
      visual: {
        imageWidth: '100%',
        imageAlignment: 'center',
        zoomLenseWidth: '20%',
        zoomLenseHeight: '25%',
        darkenImageOnZoom: true
      },
      behaviour: {
        autoZoom: true,
        zoomScales: '1, 1.25, 1.5, 2, 3, 5',
        zoomLevelDefault: 2
      }
    }, params);
    this.contentId = contentId;

    this.isAutoZooming = this.params.behaviour.autoZoom;
    this.zoomLenseSize = {
      width: this.sanititzeCSS(this.params.visual.zoomLenseWidth, { min: 1, default: '20 %' }),
      height: this.sanititzeCSS(this.params.visual.zoomLenseHeight, { min: 1, default: '25 %' })
    };
    this.zoomScales = this.params.behaviour.zoomScales.split(',');

    this.zoomLevel = (() => {
      if (
        typeof this.params.behaviour.zoomLevelDefault === 'number' &&
        this.zoomScales.length > this.params.behaviour.zoomLevelDefault
      ) {
        return this.params.behaviour.zoomLevelDefault;
      }
      return Math.floor(this.zoomScales.length / 2);
    })();
  }

  /**
   * SanitizeCSS value.
   * @param {string|number} cssValue CSS value.
   * @param {object} [params={}] Parameters.
   * @param {number} [params.min] Minimum numerical value.
   * @param {number} [params.max] Maximum numerical value.
   * @param {string} [params.default] Default value.
   * @return {string|null} Value and unit separated by space or null.
   */
  sanititzeCSS(cssValue, params = {}) {
    params.default = typeof params.default === 'string' ? params.default : null;

    if (typeof cssCalue === 'number') {
      cssValue = cssValue.toString();
    }

    if (typeof cssValue !== 'string') {
      return params.default;
    }

    cssValue = cssValue.trim();

    let value;
    let unit;

    if (/^[+-]?([0-9]*[.])?[0-9]+$/.test(cssValue)) {
      unit = 'px';
      value = cssValue.trim();
    }
    else if (cssValue.substr(-2) === 'px') {
      unit = 'px';
      value = cssValue.substr(0, cssValue.length - 2).trim();
    }
    else if (cssValue.substr(-1) === '%') {
      unit = '%';
      value = cssValue.substr(0, cssValue.length - 1).trim();
    }
    else {
      return params.default;
    }

    if (/^[+-]?([0-9]*[.])?[0-9]+$/.test(value) === false) {
      return params.default;
    }

    const numeric = parseFloat(value);
    if (typeof params.min === 'number' && numeric < params.min) {
      return params.default;
    }
    else if (typeof params.max === 'number' && numeric > params.max) {
      return params.default;
    }

    return `${value} ${unit}`;
  }

  /**
   * Get zoom lense width and height as percentage.
   * @return {object} Zoom lense width and height as percentage.
   */
  getZoomLenseSize() {
    let imageRect;

    const widthValue = parseFloat(this.zoomLenseSize.width.split(' ')[0]);
    const widthUnit = this.zoomLenseSize.width.split(' ')[1];
    let widthFactor;
    if (widthUnit === '%') {
      widthFactor = widthValue / 100;
    }
    else {
      imageRect = this.imageNavigation.getBoundingClientRect();
      widthFactor = Math.min(widthValue / imageRect.width, 1);
    }

    const heightValue = parseFloat(this.zoomLenseSize.height.split(' ')[0]);
    const heightUnit = this.zoomLenseSize.height.split(' ')[1];
    let heightFactor;
    if (heightUnit === '%') {
      heightFactor = heightValue / 100;
    }
    else {
      imageRect = imageRect || this.imageNavigation.getBoundingClientRect();
      heightFactor = Math.min(heightValue / imageRect.height, 1);
    }

    return {
      width: widthValue,
      widthUnit: widthUnit,
      widthFactor: widthFactor,
      height: heightValue,
      heightUnit: heightUnit,
      heightFactor: heightFactor
    };
  }

  /**
   * Attach library to wrapper.
   *
   * @param {jQuery} $wrapper Content's container.
   */
  attach($wrapper) {
    this.container = $wrapper.get(0);
    this.container.classList.add('h5p-image-zoom');

    if (this.params.behaviour.autoZoom) {
      this.container.classList.add('h5p-image-zoom-auto-zoom');
    }

    // Set image alignment
    if (this.params.visual.imageAlignment !== 'center') {
      this.container.style.alignItems = this.params.visual.imageAlignment;
    }

    this.displays = document.createElement('div');
    this.displays.classList.add('h5p-image-zoom-displays');

    this.displayNavigation = document.createElement('div');
    this.displayNavigation.classList.add('h5p-image-zoom-display-navigation');

    /*
     * Navigation wrapper
     */
    const wrapperNavigation = document.createElement('div');
    wrapperNavigation.classList.add('h5p-image-zoom-wrapper-navigation');

    this.imageInstance = H5P.newRunnable(
      this.params.image,
      this.contentId,
      H5P.jQuery(wrapperNavigation),
      true,
      {}
    );
    this.imageNavigation = this.imageInstance.$img.get(0);
    this.imageNavigation.setAttribute('draggable', false);
    this.imageNavigation.setAttribute('role', 'button');
    this.imageNavigation.setAttribute('tabindex', 1);
    this.imageNavigation.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        const imageRect = this.imageNavigation.getBoundingClientRect();
        this.handleClick({
          pageX: imageRect.width / 2,
          pageY: imageRect.height / 2
        });
      }
      else if (!this.isZooming) {
        return;
      }
      else if (event.key === '+') {
        event.deltaY = -1;
        this.handleWheel(event);
      }
      else if (event.key === '-') {
        event.deltaY = 1;
        this.handleWheel(event);
      }
      else if (event.key === 'ArrowLeft') {
        const lenseRect = this.wrapperLense.getBoundingClientRect();

        this.updateLense({
          x: lenseRect.left,
          y: lenseRect.top + lenseRect.height / 2
        });
      }
      else if (event.key === 'ArrowRight') {
        const lenseRect = this.wrapperLense.getBoundingClientRect();

        this.updateLense({
          x: lenseRect.left + lenseRect.width,
          y: lenseRect.top + lenseRect.height / 2
        });
      }
      else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const lenseRect = this.wrapperLense.getBoundingClientRect();

        this.updateLense({
          x: lenseRect.left + lenseRect.width / 2,
          y: lenseRect.top
        });
      }
      else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const lenseRect = this.wrapperLense.getBoundingClientRect();

        this.updateLense({
          x: lenseRect.left + lenseRect.width / 2,
          y: lenseRect.top + lenseRect.height
        });
      }
    });

    this.imageNavigation.classList.add('h5p-image-zoom-image-navigation');
    if (this.params.visual.darkenImageOnZoom) {
      this.imageNavigation.classList.add('h5p-image-zoom-darken');
    }

    this.displayNavigation.appendChild(wrapperNavigation);
    this.displays.appendChild(this.displayNavigation);

    if (this.params.image?.params?.file) {
      this.imageInstance.on('loaded', () => {
        this.handleImageLoaded();
      });
    }
    else {
      // H5P.Image provides SVG placeholder that needs height
      wrapperNavigation.classList.add('h5p-image-zoom-image-placeholder');
      this.handleImageLoaded();
    }

    /*
     * Zoom lense
     */
    this.wrapperLense = document.createElement('div');
    this.wrapperLense.classList.add('h5p-image-zoom-wrapper-lense');

    this.imageInstanceLense = H5P.newRunnable(
      this.params.image,
      this.contentId,
      H5P.jQuery(this.wrapperLense),
      true,
      {}
    );
    this.imageLense = this.imageInstanceLense.$img.get(0);
    this.imageLense.classList.add('h5p-image-zoom-image-lense');
    this.displayNavigation.appendChild(this.wrapperLense);

    $wrapper.append(this.displays);
  }

  /**
   * Get zoom scale.
   * @param {number} [zoomLevel] Zoom level, defaults to global state.
   * @return {number} Zoom scale.
   */
  getZoomScale(zoomLevel) {
    zoomLevel = zoomLevel || this.zoomLevel;

    if (
      typeof zoomLevel !== 'number' ||
      zoomLevel < 0 ||
      zoomLevel >= this.zoomScales.length
    ) {
      return;
    }

    return this.zoomScales[zoomLevel];
  }

  /**
   * Handle image loaded.
   */
  handleImageLoaded() {
    // Set image width
    const width = this.params.visual.imageWidth === 'natural' ?
      `${this.imageNavigation.naturalWidth}px` :
      this.params.visual.imageWidth;
    this.displays.style.width = width;

    // Set zoom lense size.
    const zoomLenseSize = this.getZoomLenseSize();

    this.wrapperLense.style.width = (zoomLenseSize.widthUnit === '%') ?
      `calc(100% * ${zoomLenseSize.widthFactor})` :
      `min(100%, ${zoomLenseSize.width}px)`;

    this.wrapperLense.style.height = (zoomLenseSize.heightUnit === '%') ?
      `calc(100% * ${zoomLenseSize.heightFactor})` :
      `min(100%, ${zoomLenseSize.height}px)`;

    // Add event listeners
    if (!this.params.behaviour.autoZoom) {
      this.displayNavigation.addEventListener('click', event => {
        this.handleClick(event);
      });
    }

    this.displayNavigation.addEventListener('mouseover', () => {
      this.handleMouseOver();
    });

    this.displayNavigation.addEventListener('mousemove', event => {
      this.handleMouseMove(event);
    });

    this.displayNavigation.addEventListener('mouseout', (event) => {
      this.handleMouseOut(event);
    });

    this.displayNavigation.addEventListener('wheel', event => {
      this.handleWheel(event);
    });

    this.trigger('resize');
  }

  /**
   * Set zoom level.
   * @param {number|null} zoomLevel Zoom level to set, null to reset.
   */
  setZoomLevel(zoomLevel) {
    if (zoomLevel === null) {
      zoomLevel = Math.floor(this.zoomScales.length / this.params.behaviour.zoomLevelDefault);
    }

    if (
      typeof zoomLevel !== 'number' ||
      zoomLevel < 0 ||
      zoomLevel >= this.zoomScales.length
    ) {
      return;
    }

    this.zoomLevel = zoomLevel;
    const zoomLenseSize = this.getZoomLenseSize();
    this.imageLense.style.transform = `scale(${this.getZoomScale(this.zoomLevel) / zoomLenseSize.widthFactor}, ${this.getZoomScale(this.zoomLevel) / zoomLenseSize.heightFactor})`;
  }

  /**
   * Update lense.
   * @param {object} position Pointer position on screen.
   * @param {number} position.x X pointer position.
   * @param {number} position.y Y pointer position.
   */
  updateLense(position) {
    const imageRect = this.imageNavigation.getBoundingClientRect();
    const lenseRect = this.wrapperLense.getBoundingClientRect();

    const imagePointerPosition = {
      x: position.x - imageRect.left,
      y: position.y - imageRect.top
    };

    const lensePosition = {
      x: Math.max(0, Math.min(imagePointerPosition.x - lenseRect.width / 2, imageRect.width - lenseRect.width)),
      y: Math.max(0, Math.min(imagePointerPosition.y - lenseRect.height / 2, imageRect.height - lenseRect.height))
    };

    this.wrapperLense.style.left = `${lensePosition.x}px`;
    this.wrapperLense.style.top = `${lensePosition.y}px`;

    const lenseOffsets = {
      minX: lenseRect.width / 2,
      maxX: imageRect.width - lenseRect.width / 2,
      minY: lenseRect.height / 2,
      maxY: imageRect.height - lenseRect.height / 2
    };

    const cappedPosition = {
      x: Math.max(lenseOffsets.minX, Math.min(imagePointerPosition.x, lenseOffsets.maxX)),
      y: Math.max(lenseOffsets.minY, Math.min(imagePointerPosition.y, lenseOffsets.maxY))
    };

    const cappedPositionPercentage = {
      x: Util.project(cappedPosition.x, lenseOffsets.minX, lenseOffsets.maxX, 0, 100),
      y: Util.project(cappedPosition.y, lenseOffsets.minY, lenseOffsets.maxY, 0, 100)
    };

    this.imageLense.style.transformOrigin = `${cappedPositionPercentage.x}% ${cappedPositionPercentage.y}%`;
  }

  /**
   * Handle mouse wheel change.
   * @param {Event} event Wheel event.
   */
  handleWheel(event) {
    if (!this.isZooming) {
      return;
    }

    if (event instanceof WheelEvent) {
      event.preventDefault(); // Don't scroll page.
    }

    this.setZoomLevel(Math.max(0, Math.min(this.zoomLevel - Math.sign(event.deltaY), this.zoomScales.length - 1)));
  }

  /**
   * Handle click.
   * @param {Event} event Click event.
   */
  handleClick(event) {
    if (event instanceof MouseEvent) {
      if (!this.isAutoZooming) {
        this.isAutoZooming = true;
        this.handleMouseOver();
        this.handleMouseMove(event);
      }
      else {
        this.handleMouseOut();
        if (!this.params.behaviour.autoZoom) {
          this.isAutoZooming = false;
        }
      }
    }
    else {
      if (!this.isZooming) {
        this.isAutoZooming = true;
        this.handleMouseOver();
        this.handleMouseMove(event);
      }
      else {
        this.handleMouseOut();
        if (!this.params.behaviour.autoZoom) {
          this.isAutoZooming = false;
        }
      }
    }

  }

  /**
   * Handle pointer enters image.
   */
  handleMouseOver() {
    if (!this.isAutoZooming) {
      return;
    }

    this.isZooming = true;
    this.setZoomLevel(this.zoomLevel);
    this.container.classList.add('h5p-image-zoom-active');
    this.imageNavigation.focus();
  }

  /**
   * Handle mouse pointer moving over image.
   * @param {Event} event Mouse event.
   */
  handleMouseMove(event) {
    if (!this.isZooming) {
      return;
    }

    this.updateLense({ x: event.pageX, y: event.pageY });
  }

  /**
   * Handle pointer leaves image.
   */
  handleMouseOut() {
    if (!this.isAutoZooming) {
      return;
    }

    this.isZooming = false;
    this.container.classList.remove('h5p-image-zoom-active');
    this.setZoomLevel(null);
  }
}
