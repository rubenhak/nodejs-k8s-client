
export interface KubernetesVersionInfoRaw
{
    major: string,
    minor: string,
    gitVersion: string,
    gitCommit: string,
    gitTreeState: string,
    buildDate: string,
    goVersion: string,
    compiler: string,
    platform: string,
}

export interface KubernetesVersionInfo
{
    major: number,
    minor: number,
    gitVersion: string,
    gitCommit: string,
    gitTreeState: string,
    buildDate: Date,
    goVersion: string,
    compiler: string,
    platform: string,
}




export interface OpenApiDefinition
{
    type: string,
    required?: string[];
    properties?: Record<string, OpenApiDefinition>;
    items?: OpenApiDefinition;
}


export interface K8sOpenApiPathExtension
{
    ["x-kubernetes-action"]?: string,
    ["x-kubernetes-group-version-kind"]?: {
        group: string;
        kind: string;
        version: string;
    }
}
