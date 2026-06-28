import { expect, test } from "vitest";

import { APP_NAME } from "./index";

test("app name is set", () => {
  expect(APP_NAME).toBe("DataPulse");
});
