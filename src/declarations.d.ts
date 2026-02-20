// Declarations for imported assets
declare module "*.svg" {
    const src: string;
    export default src;
}
declare module "*.png" {
    const src: string;
    export default src;
}

declare module "*.svg?raw" {
    const content: string;
    export default content;
}

// Minimal Chrome Extension Type Definitions for dev environment
declare namespace chrome {
    export namespace permissions {
        export function contains(permissions: { origins?: string[], permissions?: string[] }, callback?: (result: boolean) => void): Promise<boolean>;
        export function request(permissions: { origins?: string[], permissions?: string[] }, callback?: (granted: boolean) => void): Promise<boolean>;
        export function remove(permissions: { origins?: string[], permissions?: string[] }, callback?: (removed: boolean) => void): Promise<boolean>;
    }
    export namespace bookmarks {
        export interface BookmarkTreeNode {
            id: string;
            title?: string;
            url?: string;
            children?: BookmarkTreeNode[];
        }

        export function getTree(callback: (results: BookmarkTreeNode[]) => void): void;
    }
    export namespace runtime {
        export const lastError: { message?: string } | undefined;
    }
}
