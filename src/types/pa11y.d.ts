declare module "pa11y" {
  export interface Pa11yIssue {
    code: string;
    context: string;
    message: string;
    selector: string;
    type: string;
  }

  export interface Pa11yResult {
    documentTitle: string;
    issues: Pa11yIssue[];
    pageUrl: string;
  }

  export default function pa11y(url: string): Promise<Pa11yResult>;
}
