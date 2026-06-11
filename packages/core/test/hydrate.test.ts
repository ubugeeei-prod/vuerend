import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnyDefinedIsland } from "../src/runtime/types";

const vueMocks = vi.hoisted(() => ({
  createSSRApp: vi.fn(),
}));

const vaporMocks = vi.hoisted(() => ({
  createVaporSSRApp: vi.fn(),
  vaporInteropPlugin: vi.fn(),
}));

vi.mock("vue", () => ({
  Fragment: Symbol("Fragment"),
  createSSRApp: vueMocks.createSSRApp,
  defineAsyncComponent: vi.fn((loader) => ({ loader })),
  defineComponent: vi.fn((options) => options),
  h: vi.fn(),
  inject: vi.fn(),
  mergeProps: vi.fn((...props) => Object.assign({}, ...props)),
  provide: vi.fn(),
}));

vi.mock("@vue/runtime-vapor", () => ({
  createVaporSSRApp: vaporMocks.createVaporSSRApp,
  vaporInteropPlugin: vaporMocks.vaporInteropPlugin,
}));

describe("hydrateIslands", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vueMocks.createSSRApp.mockReset();
    vaporMocks.createVaporSSRApp.mockReset();
    vaporMocks.vaporInteropPlugin.mockReset();
  });

  it("hydrates on an early click and replays it after mount", async () => {
    const root = new FakeElement("div");
    const button = new FakeElement("button");
    const observerCallbacks: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    let replayedClicks = 0;

    root.dataset.vsIsland = "island-1";
    root.dataset.vsComponent = "counter";
    root.dataset.vsHydrate = "visible";
    root.append(button);

    vi.stubGlobal("CSS", {
      escape: (value: string) => value,
    });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => ({ textContent: "{}" })),
      querySelectorAll: vi.fn(() => [root]),
    });
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLFormElement", FakeElement);
    vi.stubGlobal("MouseEvent", FakeMouseEvent);
    const FakeIntersectionObserver = class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observerCallbacks.push(callback);
      }

      disconnect() {}

      observe() {}
    };
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    vi.stubGlobal("window", {
      IntersectionObserver: FakeIntersectionObserver,
    });

    const load = vi.fn(async () => ({ default: {} }));
    const island = {
      __vuerendIsland: {
        hydrate: "visible",
        id: "counter",
        load,
        ssr: true,
      },
    } as unknown as AnyDefinedIsland;

    vueMocks.createSSRApp.mockReturnValue({
      mount() {
        button.addEventListener("click", () => {
          replayedClicks += 1;
        });
      },
    });

    const { hydrateIslands } = await import("../src/client/hydrate");
    const hydration = hydrateIslands([island]);
    const earlyClick = new FakeMouseEvent("click", { bubbles: true, cancelable: true });

    button.dispatchEvent(earlyClick);
    await flushPromises();

    expect(earlyClick.defaultPrevented).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(replayedClicks).toBe(1);

    observerCallbacks[0]?.([{ isIntersecting: true }]);
    await hydration;

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("hydrates on idle using requestIdleCallback when available", async () => {
    const root = new FakeElement("div");
    const app = { mount: vi.fn() };
    let idleCallback: (() => void) | undefined;

    root.dataset.vsIsland = "island-1";
    root.dataset.vsComponent = "counter";
    root.dataset.vsHydrate = "idle";

    vi.stubGlobal("CSS", { escape: (value: string) => value });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => ({ textContent: "{}" })),
      querySelectorAll: vi.fn(() => [root]),
    });
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLFormElement", FakeElement);
    vi.stubGlobal("MouseEvent", FakeMouseEvent);

    const requestIdleCallback = vi.fn((callback: () => void) => {
      idleCallback = callback;
    });
    vi.stubGlobal("window", { requestIdleCallback });

    const load = vi.fn(async () => ({ default: {} }));
    const island = {
      __vuerendIsland: { hydrate: "idle", id: "counter", load, ssr: true },
    } as unknown as AnyDefinedIsland;

    vueMocks.createSSRApp.mockReturnValue(app);

    const { hydrateIslands } = await import("../src/client/hydrate");
    const hydration = hydrateIslands([island]);

    await flushPromises();

    // Nothing mounts until the idle callback fires.
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();
    expect(app.mount).not.toHaveBeenCalled();

    idleCallback?.();
    await hydration;

    expect(load).toHaveBeenCalledTimes(1);
    expect(app.mount).toHaveBeenCalledTimes(1);
    expect(app.mount.mock.calls[0]?.[0]).toBe(root);
  });

  it("falls back to setTimeout when requestIdleCallback is unavailable", async () => {
    const root = new FakeElement("div");
    const app = { mount: vi.fn() };

    root.dataset.vsIsland = "island-1";
    root.dataset.vsComponent = "counter";
    root.dataset.vsHydrate = "idle";

    vi.stubGlobal("CSS", { escape: (value: string) => value });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => ({ textContent: "{}" })),
      querySelectorAll: vi.fn(() => [root]),
    });
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLFormElement", FakeElement);
    vi.stubGlobal("MouseEvent", FakeMouseEvent);

    // No requestIdleCallback on the window: the fallback timer must drive mount.
    vi.stubGlobal("window", {});

    const load = vi.fn(async () => ({ default: {} }));
    const island = {
      __vuerendIsland: { hydrate: "idle", id: "counter", load, ssr: true },
    } as unknown as AnyDefinedIsland;

    vueMocks.createSSRApp.mockReturnValue(app);

    const { hydrateIslands } = await import("../src/client/hydrate");
    const hydration = hydrateIslands([island]);

    // flushPromises awaits a macrotask, allowing the setTimeout fallback to fire.
    await flushPromises();
    await hydration;

    expect(load).toHaveBeenCalledTimes(1);
    expect(app.mount).toHaveBeenCalledTimes(1);
    expect(app.mount.mock.calls[0]?.[0]).toBe(root);
  });

  it("hydrates immediately when the media query already matches", async () => {
    const root = new FakeElement("div");
    const app = { mount: vi.fn() };
    const addEventListener = vi.fn();

    root.dataset.vsIsland = "island-1";
    root.dataset.vsComponent = "counter";
    root.dataset.vsHydrate = "media";
    root.dataset.vsMedia = "(min-width: 768px)";

    vi.stubGlobal("CSS", { escape: (value: string) => value });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => ({ textContent: "{}" })),
      querySelectorAll: vi.fn(() => [root]),
    });
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLFormElement", FakeElement);
    vi.stubGlobal("MouseEvent", FakeMouseEvent);

    const matchMedia = vi.fn((query: string) => ({
      addEventListener,
      matches: true,
      media: query,
    }));
    vi.stubGlobal("window", { matchMedia });

    const load = vi.fn(async () => ({ default: {} }));
    const island = {
      __vuerendIsland: { hydrate: "media", id: "counter", load, ssr: true },
    } as unknown as AnyDefinedIsland;

    vueMocks.createSSRApp.mockReturnValue(app);

    const { hydrateIslands } = await import("../src/client/hydrate");
    await hydrateIslands([island]);

    expect(matchMedia).toHaveBeenCalledWith("(min-width: 768px)");
    expect(addEventListener).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
    expect(app.mount).toHaveBeenCalledTimes(1);
    expect(app.mount.mock.calls[0]?.[0]).toBe(root);
  });

  it("hydrates when the media query becomes a match", async () => {
    const root = new FakeElement("div");
    const app = { mount: vi.fn() };
    let changeListener: (() => void) | undefined;
    let listenerOptions: AddEventListenerOptions | undefined;

    root.dataset.vsIsland = "island-1";
    root.dataset.vsComponent = "counter";
    root.dataset.vsHydrate = "media";
    root.dataset.vsMedia = "(min-width: 768px)";

    vi.stubGlobal("CSS", { escape: (value: string) => value });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => ({ textContent: "{}" })),
      querySelectorAll: vi.fn(() => [root]),
    });
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLFormElement", FakeElement);
    vi.stubGlobal("MouseEvent", FakeMouseEvent);

    const matchMedia = vi.fn((query: string) => ({
      addEventListener: (type: string, listener: () => void, options?: AddEventListenerOptions) => {
        if (type === "change") {
          changeListener = listener;
          listenerOptions = options;
        }
      },
      matches: false,
      media: query,
    }));
    vi.stubGlobal("window", { matchMedia });

    const load = vi.fn(async () => ({ default: {} }));
    const island = {
      __vuerendIsland: { hydrate: "media", id: "counter", load, ssr: true },
    } as unknown as AnyDefinedIsland;

    vueMocks.createSSRApp.mockReturnValue(app);

    const { hydrateIslands } = await import("../src/client/hydrate");
    const hydration = hydrateIslands([island]);

    await flushPromises();

    // The island waits for the media query to start matching.
    expect(matchMedia).toHaveBeenCalledWith("(min-width: 768px)");
    expect(listenerOptions).toEqual({ once: true });
    expect(load).not.toHaveBeenCalled();
    expect(app.mount).not.toHaveBeenCalled();

    changeListener?.();
    await hydration;

    expect(load).toHaveBeenCalledTimes(1);
    expect(app.mount).toHaveBeenCalledTimes(1);
    expect(app.mount.mock.calls[0]?.[0]).toBe(root);
  });

  it("replays an early form submit after mount", async () => {
    const root = new FakeElement("div");
    const form = new FakeElement("form");
    const observerCallbacks: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    let replayedSubmits = 0;

    root.dataset.vsIsland = "island-1";
    root.dataset.vsComponent = "counter";
    root.dataset.vsHydrate = "visible";
    root.append(form);

    vi.stubGlobal("CSS", { escape: (value: string) => value });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => ({ textContent: "{}" })),
      querySelectorAll: vi.fn(() => [root]),
    });
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLFormElement", FakeElement);
    vi.stubGlobal("MouseEvent", FakeMouseEvent);
    vi.stubGlobal("SubmitEvent", FakeSubmitEvent);
    const FakeIntersectionObserver = class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observerCallbacks.push(callback);
      }

      disconnect() {}

      observe() {}
    };
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    vi.stubGlobal("window", { IntersectionObserver: FakeIntersectionObserver });

    const load = vi.fn(async () => ({ default: {} }));
    const island = {
      __vuerendIsland: { hydrate: "visible", id: "counter", load, ssr: true },
    } as unknown as AnyDefinedIsland;

    vueMocks.createSSRApp.mockReturnValue({
      mount() {
        form.addEventListener("submit", () => {
          replayedSubmits += 1;
        });
      },
    });

    const { hydrateIslands } = await import("../src/client/hydrate");
    const hydration = hydrateIslands([island]);
    const earlySubmit = new FakeSubmitEvent("submit", { bubbles: true, cancelable: true });

    form.dispatchEvent(earlySubmit);
    await flushPromises();

    // The early submit is suppressed, mount is forced, and the submit is replayed.
    expect(earlySubmit.defaultPrevented).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(replayedSubmits).toBe(1);

    observerCallbacks[0]?.([{ isIntersecting: true }]);
    await hydration;

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("hydrates vapor islands with createVaporSSRApp", async () => {
    const root = new FakeElement("div");
    const load = vi.fn(async () => ({ default: {} }));
    const app = { mount: vi.fn() };

    root.dataset.vsIsland = "island-1";
    root.dataset.vsComponent = "counter";
    vaporMocks.createVaporSSRApp.mockReturnValue(app);

    vi.stubGlobal("CSS", {
      escape: (value: string) => value,
    });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => ({ textContent: "{}" })),
      querySelectorAll: vi.fn(() => [root]),
    });

    const island = {
      __vuerendIsland: {
        hydrate: "load",
        id: "counter",
        load,
        ssr: true,
      },
    } as unknown as AnyDefinedIsland;

    const { hydrateVaporIslands } = await import("../src/client/vapor-hydrate");
    await hydrateVaporIslands([island], true);

    expect(vaporMocks.createVaporSSRApp).toHaveBeenCalledWith({}, {});
    expect(app.mount).toHaveBeenCalledWith(root);
    expect(vueMocks.createSSRApp).not.toHaveBeenCalled();
  });

  it("can use vapor interop mode for mixed islands", async () => {
    const root = new FakeElement("div");
    const load = vi.fn(async () => ({ default: {} }));
    const app = {
      mount: vi.fn(),
      use: vi.fn(),
    };

    root.dataset.vsIsland = "island-1";
    root.dataset.vsComponent = "counter";
    app.use.mockReturnValue(app);
    vueMocks.createSSRApp.mockReturnValue(app);

    vi.stubGlobal("CSS", {
      escape: (value: string) => value,
    });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => ({ textContent: "{}" })),
      querySelectorAll: vi.fn(() => [root]),
    });

    const island = {
      __vuerendIsland: {
        hydrate: "load",
        id: "counter",
        load,
        ssr: true,
      },
    } as unknown as AnyDefinedIsland;

    const { hydrateVaporIslands } = await import("../src/client/vapor-hydrate");
    await hydrateVaporIslands([island], "interop");

    expect(vueMocks.createSSRApp).toHaveBeenCalledWith({}, {});
    expect(app.use).toHaveBeenCalledWith(vaporMocks.vaporInteropPlugin);
    expect(app.mount).toHaveBeenCalledWith(root);
  });

  it("can install interop inside a vapor island app lazily", async () => {
    const root = new FakeElement("div");
    const load = vi.fn(async () => ({ default: {} }));
    const app = {
      mount: vi.fn(),
      use: vi.fn(),
    };

    root.dataset.vsIsland = "island-1";
    root.dataset.vsComponent = "counter";
    app.use.mockReturnValue(app);
    vaporMocks.createVaporSSRApp.mockReturnValue(app);

    vi.stubGlobal("CSS", {
      escape: (value: string) => value,
    });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => ({ textContent: "{}" })),
      querySelectorAll: vi.fn(() => [root]),
    });

    const island = {
      __vuerendIsland: {
        hydrate: "load",
        id: "counter",
        load,
        ssr: true,
      },
    } as unknown as AnyDefinedIsland;

    const { hydrateVaporIslands } = await import("../src/client/vapor-hydrate");
    await hydrateVaporIslands([island], { interop: true });

    expect(vaporMocks.createVaporSSRApp).toHaveBeenCalledWith({}, {});
    expect(vueMocks.createSSRApp).not.toHaveBeenCalled();
    expect(app.use).toHaveBeenCalledWith(vaporMocks.vaporInteropPlugin);
    expect(app.mount).toHaveBeenCalledWith(root);
  });
});

class FakeMouseEvent {
  readonly altKey = false;
  readonly button = 0;
  readonly buttons = 0;
  readonly clientX = 0;
  readonly clientY = 0;
  readonly composed: boolean;
  readonly ctrlKey = false;
  readonly detail = 0;
  readonly metaKey = false;
  readonly screenX = 0;
  readonly screenY = 0;
  readonly shiftKey = false;
  readonly type: string;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  defaultPrevented = false;
  propagationStopped = false;
  target: FakeElement | undefined;

  constructor(type: string, init: Partial<MouseEventInit> = {}) {
    this.type = type;
    this.bubbles = init.bubbles ?? false;
    this.cancelable = init.cancelable ?? false;
    this.composed = init.composed ?? false;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  stopImmediatePropagation() {
    this.propagationStopped = true;
  }
}

class FakeSubmitEvent {
  readonly type: string;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly composed: boolean;
  defaultPrevented = false;
  propagationStopped = false;
  target: FakeElement | undefined;

  constructor(type: string, init: Partial<EventInit> = {}) {
    this.type = type;
    this.bubbles = init.bubbles ?? false;
    this.cancelable = init.cancelable ?? false;
    this.composed = init.composed ?? false;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  stopImmediatePropagation() {
    this.propagationStopped = true;
  }
}

class FakeElement {
  readonly children = createFakeChildren();
  readonly dataset: Record<string, string | undefined> = {};
  readonly tagName: string;
  parentElement: FakeElement | null = null;
  private readonly listeners = new Map<string, Array<(event: FakeMouseEvent) => void>>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  addEventListener(type: string, listener: (event: FakeMouseEvent) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  append(child: FakeElement) {
    child.parentElement = this;
    this.children.push(child);
  }

  closest(selector: string): FakeElement | null {
    if (this.tagName === "BUTTON" && selector.includes("button")) {
      return this;
    }

    return this.parentElement?.closest(selector) ?? null;
  }

  contains(target: FakeElement) {
    let current: FakeElement | null = target;

    while (current) {
      if (current === this) {
        return true;
      }

      current = current.parentElement;
    }

    return false;
  }

  click() {
    this.dispatchEvent(new FakeMouseEvent("click", { bubbles: true, cancelable: true }));
  }

  dispatchEvent(event: FakeMouseEvent): boolean {
    event.target ??= this;

    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);

      if (event.propagationStopped) {
        return !event.defaultPrevented;
      }
    }

    if (event.bubbles && this.parentElement) {
      return this.parentElement.dispatchEvent(event);
    }

    return !event.defaultPrevented;
  }

  removeEventListener(type: string, listener: (event: FakeMouseEvent) => void) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      listeners.filter((entry) => entry !== listener),
    );
  }
}

interface FakeChildren extends Array<FakeElement> {
  item(index: number): FakeElement | null;
}

function createFakeChildren(): FakeChildren {
  const children = [] as unknown as FakeChildren;
  children.item = (index: number) => children[index] ?? null;
  return children;
}

async function flushPromises() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }

  await vi.dynamicImportSettled();
  await new Promise((resolve) => setTimeout(resolve, 0));

  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}
