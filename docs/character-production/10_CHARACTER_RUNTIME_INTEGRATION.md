# Character Runtime Integration

## Audit first
Inspect character manager, AnimationController, emotion/morph systems, audio controller, GLB loader, renderer, overlay, notification engine, Focus/Hidden/Reduced Motion, switching, resource cleanup and tests.

## Principle
Extend existing modules. No duplicate controllers, event routers or renderers.

## Shared event flow
Event source -> event/context resolver -> emotion -> animation and audio controllers -> coordinated visual/audio response.

## Responsibilities
Character manager: lifecycle. Animation controller: clips/blending. Emotion controller: emotion mapping. Audio controller: gating/selection/playback. Asset manager: loading/unloading. Renderer: rendering. Event router: shared events. Notification engine: notification context.

## Lifecycle
Stop/fade audio when hidden or switching; dispose unused geometry, textures and materials; release animation references; remove listeners; cancel stale events; prevent state leakage and memory leaks.

## Performance
Measure CPU/GPU, FPS, memory, loading, idle usage, audio overhead, switching and animation blending. Consider on-demand rendering only if compatible with architecture.
