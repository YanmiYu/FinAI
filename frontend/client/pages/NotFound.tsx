import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="h-screen w-full bg-background text-foreground flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-primary mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The page <code className="text-primary">{location.pathname}</code> doesn't exist.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          Return to Chat
        </a>
      </div>
    </div>
  );
};

export default NotFound;
