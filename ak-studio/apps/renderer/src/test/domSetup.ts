// Setup for the renderer's DOM tests (`*.test.tsx`, happy-dom): unmounts what each test rendered, so the next
// test starts from an empty document (Testing Library only does this by itself when the test globals are on).
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
	cleanup();
});
