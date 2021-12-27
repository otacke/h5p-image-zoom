/** Class for utility functions */
export default class Util {
  /**
   * Extend an array just like JQuery's extend.
   * @param {object} arguments Objects to be merged.
   * @return {object} Merged objects.
   */
  static extend() {
    for (let i = 1; i < arguments.length; i++) {
      for (let key in arguments[i]) {
        if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
          if (typeof arguments[0][key] === 'object' && typeof arguments[i][key] === 'object') {
            this.extend(arguments[0][key], arguments[i][key]);
          }
          else {
            arguments[0][key] = arguments[i][key];
          }
        }
      }
    }
    return arguments[0];
  }

  /**
   * Map a value from one range to another.
   * @param {number} value Value to me remapped.
   * @param {number} lo1 Lower boundary of first range.
   * @param {number} hi1 Upper boundary of first range.
   * @param {number} lo2 Lower boundary of second range.
   * @param {number} hi2 Upper boundary of second range.
   * @return {number} Remapped value.
   */
  static project(value, lo1, hi1, lo2, hi2) {
    return lo2 + (hi2 - lo2) * (value - lo1) / (hi1 - lo1);
  }

  /**
   * Get maxtrix components of CSS transform property.
   * @param {HTMLElement} element DOM element.
   * @return {object} Components: angle, rotation, scale, skew, translation.
   */
  static getCSSTransformValues(element) {
    const style = window.getComputedStyle(element);
    const matrix = style.transform;

    let matrixValues;

    if (matrix && matrix.indexOf('matrix(') !== -1) {
      matrixValues = matrix.split('(')[1].split(')')[0].split(',');
    }
    else {
      matrixValues = [1, 0, 0, 1, 0, 0];
    }

    const a = matrixValues[0];
    const b = matrixValues[1];
    const c = matrixValues[2];
    const d = matrixValues[3];
    const e = matrixValues[4];
    const f = matrixValues[5];

    const delta = a * d - b * c;

    const result = {
      translate: {
        x: parseFloat(e),
        y: parseFloat(f)
      },
      rotate: 0,
      scale: {
        x: 0,
        y: 0
      },
      skew: {
        x: 0,
        y: 0
      }
    };

    // Apply the QR-like decomposition.
    if (a !== 0 || b !== 0) {
      const r = Math.sqrt(a * a + b * b);
      result.rotate = b > 0 ? Math.acos(a / r) : - Math.acos(a / r);
      result.scale = {
        x: r,
        y: delta / r
      };
      result.skew = {
        x: Math.atan((a * c + b * d) / (r * r)),
        y: 0
      };
    }
    else if (c !== 0 || d !== 0) {
      const s = Math.sqrt(c * c + d * d);
      result.rotate =
        Math.PI / 2 - (d > 0 ? Math.acos(-c / s) : -Math.acos(c / s));
      result.scale = {
        x: delta / s,
        y: s
      };
      result.skew = {
        x: 0,
        y: Math.atan((a * c + b * d) / (s * s))
      };
    }

    result.angle = Math.round(result.rotate * (180 / Math.PI));

    // Only use degrees of 0-359
    result.angle = result.angle % 360;
    if (result.angle < 0) {
      result.angle += 360;
    }

    return result;
  }
}
