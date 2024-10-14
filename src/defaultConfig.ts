import { RequestConfig } from "./index";
import { ResponseType } from "./types";
export const defaultConfig: RequestConfig = {
  url: "",
  method: "get",
  responseType: ResponseType.JSON,
};
