import { log } from "console";
import fetch, { RequestInit, FetchError, Response } from "node-fetch";
import compose from "koa-compose";
import { StatusCodes } from "http-status-codes";
import {} from "node-fetch";

console.log("Hello World");
const MOCK_URL = "http://192.168.31.141:8080/data.json";
const ERROR_URL = "http://192.168.31.141:8080/error.json";

export enum ResponseType {
  JSON = "json",
  TEXT = "text",
  BLOB = "blob",
  ARRAY_BUFFER = "arrayBuffer",
}

export type RequestConfig = RequestInit & {
  url: string;
  responseType?: ResponseType;
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

const createDefaultErrorResp = (error: FetchError) => {
  return {
    fetchStatus: FetchStatus.ERROR,
    data: null,
    error,
  };
};

const createCancelledResponse = () => {
  return {
    fetchStatus: FetchStatus.ABORT,
    data: null,
  };
};

class CustomerFetch {
  middleware: MiddlewareMap = {
    [MiddlewareType.Request]: [],
    [MiddlewareType.Response]: [],
  };
  constructor() {}

  onError(error: Error) {}

  async _request(requestConfig: RequestConfig): Promise<Response | FetchError> {
    const { url, responseType, ...fetchInit } = requestConfig;

    try {
      return await fetch(url, fetchInit);
    } catch (error: any) {
      return error;
    }
  }

  createRequestCtx(requestConfig: RequestConfig) {
    return {
      requestConfig,
      cancel: false,
    };
  }

  async createResponseCtx(
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

  async request(requestConfig: RequestConfig) {
    const reqMiddlewareFn = compose(this.middleware[MiddlewareType.Request]);
    const ctx = this.createRequestCtx(requestConfig);

    await reqMiddlewareFn(ctx);

    if (!ctx.cancel) {
      const res = await this._request(ctx.requestConfig);
      const { responseType = ResponseType.JSON } = requestConfig;

      const respConifg = { responseType };
      const respCtx = await this.createResponseCtx(res, respConifg);

      const reponseFn = compose<ResponseContext>(
        this.middleware[MiddlewareType.Response]
      );
      reponseFn(respCtx);

      return respCtx;
    }

    return createCancelledResponse();
  }

  create() {}

  /**
   * @description 注册中间件
   * @param middlewareType 中渐渐类型
   * @param fn 中间件函数
   * @returns
   */
  use(middlewareType: MiddlewareType, fn: RequestMiddleware) {
    if (typeof fn !== "function")
      throw new TypeError("middleware must be a function!");
    this.middleware[middlewareType].push(fn);
    return this;
  }
}

const run = async () => {
  try {
    const fetch = new CustomerFetch();

    // 注册一个 请求前的中间件
    fetch.use(MiddlewareType.Request, async (ctx: RequestContext, next) => {
      ctx.requestConfig.url = ERROR_URL;
      ctx.cancel = true;
      await next();
    });

    const res = await fetch.request({
      // url: ERROR_URL,
      url: MOCK_URL,
      method: "get",
    });

    console.log("res :>> ", res.data);
  } catch (error) {}
};

run();
