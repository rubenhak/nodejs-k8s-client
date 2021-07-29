
export function apiId(kindName: string, apiName?: string | null)
{
    if (apiName) {
        return `${apiName}::${kindName}`;
    }
    return kindName;
}