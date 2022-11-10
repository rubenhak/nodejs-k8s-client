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

export function apiVersionId(key: ApiResourceKey) //, apiVersionName: string)
{
    const id = {
        kind: key.kind,
        api: key.api ?? undefined,
        version: key.version
    }
    return _.stableStringify(id);
}

export interface ApiResourceKey
{
    kind: string;
    api: string | null;
    version: string;
}