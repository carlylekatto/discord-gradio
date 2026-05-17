export interface GradioComponentProps {
    label?: string;
    info?: string;
    placeholder?: string;
    minimum?: number;
    maximum?: number;
    step?: number;
    choices?: Array<string | Array<string>>;
    value?: any;
    [key: string]: any;
}

export interface GradioComponent {
    index: number;
    id: number;
    type: string;
    label: string;
    choices: Array<any> | null;
    value: any;
    props: GradioComponentProps;
}

export interface GradioSession {
    sessionId: string;
    appReference: string;
    targetApiName: string | null;
    fnIndex: number;
    appApiUrl: string;
    baseUrl: string;
    inputs: GradioComponent[];
    outputs: GradioComponent[];
    values: Record<number, any>;
    translations: Record<string, string>;
    ephemeral: boolean;
    options?: any;
    customizers?: Customizers;
    createdAt?: number;
    lastAccessedAt?: number;
}

export interface CustomizerPayload {
    session?: GradioSession;
    interaction?: any;
    result?: any;
    error?: Error;
    pageIndex?: number;
    totalPages?: number;
    component?: GradioComponent;
    props?: GradioComponentProps;
    type?: string;
    defaultDescription?: string;
}

export interface Customizers {
    loading?: (payload: CustomizerPayload) => any;
    result?: (payload: CustomizerPayload) => any;
    error?: (payload: CustomizerPayload) => any;
    pageConfirmation?: (payload: CustomizerPayload) => any;
    inputDescription?: (payload: CustomizerPayload) => string | undefined;
    markdown?: (payload: CustomizerPayload) => any;
    formatModal?: (modalData: any, session: GradioSession, pageIndex: number) => any;
}

export interface ParsedConfig {
    apiName: string | null;
    fnIndex: number;
    inputs: GradioComponent[];
    outputs: GradioComponent[];
    translations: Record<string, string>;
}
