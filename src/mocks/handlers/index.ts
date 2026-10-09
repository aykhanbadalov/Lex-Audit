import { authHandlers } from "./auth";
import { legislationHandlers } from "./legislation";
import { newsHandlers } from "./news";

// Order matters: "/news/sources" must be matched before "/news/:id".
export const handlers = [...authHandlers, ...newsHandlers, ...legislationHandlers];
