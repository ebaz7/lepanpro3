import fs from "fs";

let content = fs.readFileSync("./components/SecretariatModule.tsx", "utf8");

const safeComponentCode = `
interface SafeOnlyOfficeEditorProps {
  id: string;
  documentServerUrl: string;
  config: any;
  events_onDocumentReady?: () => void;
  events_onError?: (event: any) => void;
  onLoadComponentError?: (errorCode: number, description: string) => void;
}

const SafeOnlyOfficeEditor: React.FC<SafeOnlyOfficeEditorProps> = ({
  id,
  documentServerUrl,
  config,
  events_onDocumentReady,
  events_onError,
  onLoadComponentError,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const editorInstanceRef = React.useRef<any>(null);

  React.useEffect(() => {
    let isMounted = true;
    const cleanUrl = (documentServerUrl || "").trim().replace(/\\/+$/, "");
    const scriptUrl = cleanUrl + "/web-apps/apps/api/documents/api.js";

    const initEditor = () => {
      if (!isMounted || !containerRef.current) return;
      if (editorInstanceRef.current && typeof editorInstanceRef.current.destroyEditor === "function") {
        try {
          editorInstanceRef.current.destroyEditor();
        } catch (e) {
          console.warn("Error destroying editor:", e);
        }
        editorInstanceRef.current = null;
      }

      containerRef.current.innerHTML = "";
      const holder = document.createElement("div");
      holder.id = id + "_" + Date.now();
      holder.style.width = "100%";
      holder.style.height = "100%";
      containerRef.current.appendChild(holder);

      try {
        const DocsAPI = (window as any).DocsAPI;
        if (DocsAPI && typeof DocsAPI.DocEditor === "function") {
          const fullConfig = {
            ...config,
            events: {
              ...config.events,
              onDocumentReady: () => {
                if (isMounted) events_onDocumentReady?.();
              },
              onError: (err: any) => {
                if (isMounted) events_onError?.(err);
              },
            },
          };
          editorInstanceRef.current = new DocsAPI.DocEditor(holder.id, fullConfig);
        } else {
          onLoadComponentError?.(-1, "DocsAPI not initialized");
        }
      } catch (err: any) {
        console.error("Failed to init DocsAPI.DocEditor:", err);
        onLoadComponentError?.(-2, err?.message || "Error creating DocsAPI");
      }
    };

    const existingScript = document.querySelector('script[src="' + scriptUrl + '"]');
    if (existingScript && (window as any).DocsAPI) {
      initEditor();
    } else {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.onload = () => {
        if (isMounted) initEditor();
      };
      script.onerror = () => {
        if (isMounted) onLoadComponentError?.(-3, "خطا در بارگذاری اسکریپت ONLYOFFICE");
      };
      document.body.appendChild(script);
    }

    return () => {
      isMounted = false;
      if (editorInstanceRef.current && typeof editorInstanceRef.current.destroyEditor === "function") {
        try {
          editorInstanceRef.current.destroyEditor();
        } catch (e) {}
        editorInstanceRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [id, documentServerUrl, config?.document?.key]);

  return <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: "500px" }} />;
};
`;

if (!content.includes("const SafeOnlyOfficeEditor")) {
  content = content.replace(
    "const toPersianDigits = (str: string | number | undefined | null): string => {",
    safeComponentCode + "\nconst toPersianDigits = (str: string | number | undefined | null): string => {"
  );
  content = content.replaceAll("<DocumentEditor", "<SafeOnlyOfficeEditor");
  fs.writeFileSync("./components/SecretariatModule.tsx", content, "utf8");
  console.log("SecretariatModule.tsx successfully updated with SafeOnlyOfficeEditor!");
} else {
  console.log("Already updated!");
}
