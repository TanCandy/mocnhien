import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-6 py-32 text-center space-y-6">
      <p className="text-primary font-bold tracking-widest uppercase text-sm">404</p>
      <h1 className="text-5xl font-headline text-on-surface">Page not found</h1>
      <p className="text-on-surface-variant">The page you are looking for doesn't exist or has been moved.</p>
      <Link
        to="/"
        className="inline-block bg-primary text-on-primary px-8 py-4 rounded-full font-bold hover:bg-primary/90 transition-all"
      >
        Back to home
      </Link>
    </div>
  );
}
