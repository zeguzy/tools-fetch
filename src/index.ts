import fetch, { RequestInit, FetchError, Response } from "node-fetch";
import compose from "koa-compose";
import { StatusCodes } from "http-status-codes";

import { bind, extend, forEach, merge } from "lodash";
import { defaultConfig } from "./defaultConfig";
import { Method, ResponseType } from "./types";
import { getStaticMethods } from "./utils";

const MOCK_URL = "http://127.0.0.1:3000/test";
const ERROR_URL = "http://127.0.0.1:8080/error.json";

export type RequestConfig = RequestInit & {
  url: string;
  host?: string;
  responseType?: ResponseType;
  method?: Method;
};

export type ResponseConf = {
  responseType: ResponseType;
};

interface RequestContext {
  requestConfig: RequestConfig;
  cancel: boolean;
}

type ResponseContext = any;

type RequestMiddleware = compose.Middleware<RequestContext>;
type ResponseMiddleware = compose.Middleware<ResponseContext>;

enum MiddlewareType {
  Request,
  Response,
}

type MiddlewareMap = {
  [key in MiddlewareType]: (RequestMiddleware | ResponseMiddleware)[];
};

enum FetchStatus {
  ABORT = -1,
  OK,
  ERROR,
}

interface ResponseResult {
  fetchStatus: FetchStatus;
  data: any;
  response?: Response;
  error?: Error;
}

const createDefaultErrorResp = (error: FetchError): ResponseResult => {
  return {
    fetchStatus: FetchStatus.ERROR,
    data: null,
    error,
  };
};

const createCancelledResponse = (): ResponseResult => {
  return {
    fetchStatus: FetchStatus.ABORT,
    data: null,
  };
};

export type RequestProps = Omit<RequestConfig, "url"> & {
  url?: string;
};

export class ToolRequest {
  middleware: MiddlewareMap = {
    [MiddlewareType.Request]: [],
    [MiddlewareType.Response]: [],
  };

  defaults?: RequestProps = null;

  constructor(requestConfig: RequestProps) {
    this.defaults = requestConfig;
  }

  async _request(requestConfig: RequestConfig): Promise<Response | FetchError> {
    const { url, ...fetchInit } = requestConfig;

    try {
      return await fetch(url, fetchInit);
    } catch (error: any) {
      return error;
    }
  }

  _createRequestCtx(requestConfig: RequestConfig) {
    const { url, host } = requestConfig;
    let newUrl = url;

    if (host) {
      newUrl = `${host}${url}`;
    }

    return {
      requestConfig: {
        ...requestConfig,
        url: newUrl,
      },
      cancel: false,
    };
  }

  async _createResponseCtx(
    response: Response | FetchError,
    responseConf: ResponseConf
  ): Promise<ResponseResult> {
    if (response instanceof FetchError) {
      return Promise.resolve(createDefaultErrorResp(response));
    }

    if (
      response.status < StatusCodes.OK ||
      response.status >= StatusCodes.MULTIPLE_CHOICES
    ) {
      const result: ResponseResult = {
        fetchStatus: FetchStatus.ERROR,
        data: null,
        response: response,
        error: new Error(response.statusText),
      };
      return Promise.resolve(result);
    }

    const { responseType = ResponseType.JSON } = responseConf;
    if (response.status === StatusCodes.NO_CONTENT) {
      return {
        data: null,
        fetchStatus: FetchStatus.OK,
        response,
      };
    }

    let data;
    try {
      switch (responseType) {
        case ResponseType.JSON: {
          data = await response.json();
          break;
        }
        case ResponseType.TEXT: {
          data = await response.text();
          break;
        }
        case ResponseType.BLOB: {
          data = await response.blob();
          break;
        }
        case ResponseType.ARRAY_BUFFER: {
          data = await response.arrayBuffer();
          break;
        }

        default: {
          data = null;
        }
      }
    } catch (error) {
      data = null;
    }

    return {
      data,
      fetchStatus: FetchStatus.OK,
      response,
    };
  }

  /**
   * 发送请求并处理响应的异步函数。
   *
   * 该函数首先通过 `compose` 函数组合所有请求中间件，并创建请求上下文。
   * 如果请求未被取消，则发送请求并处理响应。响应处理包括创建响应上下文，
   * 并通过 `compose` 函数组合所有响应中间件。最后返回响应上下文或取消响应。
   *
   * @param requestConfig - 请求配置对象，包含请求的详细信息。
   * @returns 返回一个包含请求结果的 `ResponseResult` 对象的 Promise。
   */
  async request(requestConfig: RequestConfig) {
    const reqMiddlewareFn = compose(this.middleware[MiddlewareType.Request]);

    const ctx = this._createRequestCtx(merge(this.defaults, requestConfig));

    await reqMiddlewareFn(ctx);
    if (!ctx.cancel) {
      const res = this._request(ctx.requestConfig).then(() => {
        console.log(111);
      });
      console.log(222);
      const { responseType = ResponseType.JSON } = requestConfig;
      const respConfig = { responseType };
      const respCtx = await this._createResponseCtx(res, respConfig);

      const responseFn = compose<ResponseContext>(
        this.middleware[MiddlewareType.Response]
      );

      responseFn(respCtx);
      return respCtx;
    }

    return createCancelledResponse();
  }

  /**
   * 创建一个新的 `ToolRequest` 实例。
   *
   * 该方法接受一个 `RequestProps` 类型的配置对象，并使用该配置创建一个新的 `ToolRequest` 实例。
   *
   * @param instanceConfig - 用于创建新实例的配置对象。
   * @returns 返回一个新的 `ToolRequest` 实例。
   */
  static create(instanceConfig: RequestProps) {
    const instance = new ToolRequest(instanceConfig);
    return instance;
  }

  /**
   * 向 `ToolRequest` 实例中添加指定类型的中间件。
   *
   * 该方法首先检查传入的中间件函数是否为有效的函数，如果不是，则抛出一个 `TypeError` 异常。
   * 如果中间件函数有效，则将其添加到指定类型的中间件数组中，并返回当前的 `ToolRequest` 实例，以便支持链式调用。
   *
   * @param middlewareType - 中间件的类型，可以是 `Request` 或 `Response`。
   * @param fn - 要添加的中间件函数。
   * @returns 返回当前的 `ToolRequest` 实例，以便支持链式调用。
   * @throws {TypeError} 如果传入的 `fn` 不是一个函数，则抛出 `TypeError` 异常。
   */
  use(middlewareType: MiddlewareType, fn: RequestMiddleware) {
    if (typeof fn !== "function")
      throw new TypeError("middleware must be a function!");
    this.middleware[middlewareType].push(fn);
    return this;
  }
}

type RequestInstance = {
  (requestConfig: Omit<RequestConfig, "url"> & { url?: string }): Promise<{
    fetchStatus: FetchStatus;
    data: any;
  }>;
  create?: (
    config: Omit<RequestConfig, "url"> & { url?: string }
  ) => RequestInstance;

  get?: (
    url: string,
    config?: Omit<RequestConfig, "url"> & { url?: string }
  ) => Promise<ResponseResult>;
  delete?: (
    url: string,
    config?: Omit<RequestConfig, "url"> & { url?: string }
  ) => Promise<ResponseResult>;
  post?: (
    url: string,
    config?: Omit<RequestConfig, "url"> & { url?: string }
  ) => Promise<ResponseResult>;
  put?: (
    url: string,
    config?: Omit<RequestConfig, "url"> & { url?: string }
  ) => Promise<ResponseResult>;
  patch?: (
    url: string,
    config?: Omit<RequestConfig, "url"> & { url?: string }
  ) => Promise<ResponseResult>;

  use?: (
    middlewareType: MiddlewareType,
    fn: RequestMiddleware
  ) => RequestInstance;
};

function createInstance(defaultConfig: RequestConfig) {
  const context = new ToolRequest(defaultConfig);
  const instance: RequestInstance = bind(
    ToolRequest.prototype.request,
    context
  );

  forEach(["delete", "get", "post", "put", "patch"], (method) => {
    (ToolRequest as any).prototype[method] = function (
      url: string,
      config?: RequestConfig
    ) {
      const fn = bind(ToolRequest.prototype.request, context);
      return fn({
        ...config,
        url,
        method: method as Method,
      });
    };
  });

  extend(instance, getStaticMethods(ToolRequest.prototype), context, {});

  instance.create = function create(
    instanceConfig: Omit<RequestConfig, "url"> & { url?: string }
  ) {
    return createInstance(merge(defaultConfig, instanceConfig));
  };

  return instance;
}

export const request = createInstance(defaultConfig);

const run = async () => {
  try {
    const res = await request({
      url: MOCK_URL,
    }).catch((error) => {
      console.log("error :>> ", error);
    });
    console.log("res :>> ", res);

    try {
      // get
      // const res2 = await request.get(MOCK_URL);
      // console.log("res222 :>> ", res2);
      //post
      // const res3 = await request.post(MOCK_URL, {
      //   responseType: ResponseType.TEXT,
      // });
      // console.log("res3 :>> ", res3);

      // const customerRequest = request.create({
      //   host: "http://127.0.0.1:3000",
      // });

      // const res4 = await customerRequest.get("/test");
      // console.log("res4 :>> ", res4);

      console.log("object :>> ", request);
    } catch (error) {
      console.log("error :>> ", error);
    }

    // 注册一个 请求前的中间件
    // fetch.use(MiddlewareType.Request, async (ctx: RequestContext, next) => {
    //   ctx.requestConfig.url = ERROR_URL;
    //   ctx.cancel = true;
    //   await next();
    // });

    // const res = await fetch.request({
    //   // url: ERROR_URL,
    //   url: MOCK_URL,
    //   method: "get",
    // });
  } catch (error) {}
};

run();
