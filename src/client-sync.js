const axios = require("axios").default;
const https = require("https");

function init(globalOptions)
{
  return function (options)
  {
    options.httpsAgent = new https.Agent(options.httpsAgent.options);
    return axios(options)
      .then((result) => {
        return {
          success: true,
          response: {
            data: result.data,
          }
        };
      })
      .catch(reason => {
        const response = reason.response;
        let newReason = {};
        if (response)
        {
          newReason = {
            message: reason.message,
            response: {
              status: response.status,
              statusText: response.statusText,
            }
          }
        }
        else 
        {
          newReason = {
            message: reason.message
          }
        }

        return {
          success: false,
          reason: newReason
        }
      });
  };

}

module.exports = init;
