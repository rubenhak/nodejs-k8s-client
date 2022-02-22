import _ from 'the-lodash';

export function apiId(kindName: string, apiName: string | null) //, apiVersionName: string)
{
    const id = {
        kind: kindName,
        api: apiName ?? undefined
        // version: apiVersionName
    }
    return _.stableStringify(id);
}