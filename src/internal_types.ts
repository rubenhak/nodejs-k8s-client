import { Method as AxiosMethod } from 'axios';
import { AgentOptions as HttpsAgentOptions } from 'https';

export interface HttpRequestOptions
{
    method: AxiosMethod,
    baseURL?: string,
    url: string,
    headers?: any,
    httpsAgentOptions?: HttpsAgentOptions,
    params?: any,
    data?: any,
    responseType?: ResponseType | "stream",
}
