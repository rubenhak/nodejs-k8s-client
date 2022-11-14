const axiosModule = await import("axios");
const axios = axiosModule.default;
const https = await import("https");

export default async function (options)
{
  const axiosRequest = {
    method: options.method,
    baseURL: options.baseURL,
    url: options.url,
    headers: options.headers,
    httpsAgent: options.httpsAgentOptions ? new https.Agent(options.httpsAgentOptions) : undefined,
    params: options.params,
    data: options.data,
    responseType: options.responseType,
}

  return axios(axiosRequest)
    .then((result) => {
      return {
        success: true,
        response: {
          data: result.data,
        },
      };
    })
    .catch((reason) => {
      const response = reason.response;
      let newReason = {};
      if (response) {
        newReason = {
          message: reason.message,
          response: {
            status: response.status,
            statusText: response.statusText,
          },
        };
      } else {
        newReason = {
          message: reason.message,
        };
      }

      return {
        success: false,
        reason: newReason,
      };
    });
}
