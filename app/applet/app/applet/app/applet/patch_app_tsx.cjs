const fs = require('fs');

const appPath = '/app/applet/App.tsx';
let content = fs.readFileSync(appPath, 'utf8');

// 1. Add import
if (!content.includes('PublicCustomerSurveyPage')) {
    content = content.replace(
        "import { PublicBioPage } from './components/PublicBioPage';",
        "import { PublicBioPage } from './components/PublicBioPage';\nimport { PublicCustomerSurveyPage } from './components/PublicCustomerSurveyPage';"
    );
}

// 2. Add checkIsPublicSurveyRoute
const surveyHelperCode = `
  // Helper to determine if current URL is a public customer survey page
  const checkIsPublicSurveyRoute = (): boolean => {
    try {
      const rawHash = (window.location.hash || '').toLowerCase();
      const rawPath = (window.location.pathname || '').toLowerCase();
      const rawSearch = (window.location.search || '').toLowerCase();
      return (
        rawHash.startsWith('#customer-survey') ||
        rawHash.startsWith('#survey') ||
        rawPath.startsWith('/survey') ||
        rawSearch.includes('customer-survey') ||
        rawSearch.includes('survey=')
      );
    } catch {
      return false;
    }
  };
`;

if (!content.includes('checkIsPublicSurveyRoute')) {
  content = content.replace(
    "const checkIsPublicBioRoute = (): boolean => {",
    surveyHelperCode + "\n  const checkIsPublicBioRoute = (): boolean => {"
  );
  
  content = content.replace(
    "const [isPublicBioView, setIsPublicBioView] = useState<boolean>(() => checkIsPublicBioRoute());",
    "const [isPublicBioView, setIsPublicBioView] = useState<boolean>(() => checkIsPublicBioRoute());\n  const [isPublicSurveyView, setIsPublicSurveyView] = useState<boolean>(() => checkIsPublicSurveyRoute());"
  );

  content = content.replace(
    "const stillPublic = checkIsPublicBioRoute();\n      setIsPublicBioView(stillPublic);",
    "const stillPublic = checkIsPublicBioRoute();\n      setIsPublicBioView(stillPublic);\n      const stillSurvey = checkIsPublicSurveyRoute();\n      setIsPublicSurveyView(stillSurvey);"
  );

  content = content.replace(
    "if (checkIsPublicBioRoute()) return;",
    "if (checkIsPublicBioRoute() || checkIsPublicSurveyRoute()) return;"
  );

  const jsxTarget = `{isPublicBioView ? (
            <div className="fixed inset-0 z-[99999999] w-full h-full overflow-y-auto overscroll-y-contain bg-slate-50 dark:bg-slate-950" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              <PublicBioPage 
                  config={publicBioConfig || FALLBACK_BIO_CONFIG}
              />
            </div>
        ) : !currentUser ? (`;

  const jsxReplacement = `{isPublicBioView ? (
            <div className="fixed inset-0 z-[99999999] w-full h-full overflow-y-auto overscroll-y-contain bg-slate-50 dark:bg-slate-950" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              <PublicBioPage 
                  config={publicBioConfig || FALLBACK_BIO_CONFIG}
              />
            </div>
        ) : isPublicSurveyView ? (
            <div className="fixed inset-0 z-[99999999] w-full h-full overflow-y-auto overscroll-y-contain bg-slate-950 text-white" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              <PublicCustomerSurveyPage />
            </div>
        ) : !currentUser ? (`;

  content = content.replace(jsxTarget, jsxReplacement);
  fs.writeFileSync(appPath, content, 'utf8');
  console.log('Successfully patched App.tsx for PublicCustomerSurveyPage!');
} else {
  console.log('PublicCustomerSurveyPage already patched in App.tsx');
}
