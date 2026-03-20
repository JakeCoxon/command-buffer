import { DemoHost } from "./app/demoHost";
import { demoRegistry } from "./app/demoRegistry";
import { getUiSlots } from "./app/uiSlots";

const host = new DemoHost({
  slots: getUiSlots(),
  demos: demoRegistry,
  defaultDemoId: "moving-rects",
});

void host.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    host.destroy();
  });
}
