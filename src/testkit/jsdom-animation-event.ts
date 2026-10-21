// jsdom has no AnimationEvent, so React DOM listens for the webkit-prefixed `webkitAnimationEnd` instead and an
// `animationend` never reaches onAnimationEnd. A bare stand-in, defined before React DOM loads, makes React listen
// for the standard name.
if (!('AnimationEvent' in window)) {
    Object.defineProperty(window, 'AnimationEvent', { value: class AnimationEvent extends Event {} });
}
