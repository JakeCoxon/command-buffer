/// <reference types="vite/client" />

declare module "*.png?url" {
  const url: string;
  export default url;
}

declare module "*.json?url" {
  const url: string;
  export default url;
}
