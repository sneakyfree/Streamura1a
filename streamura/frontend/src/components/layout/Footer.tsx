import { Link } from 'react-router-dom';
import { Twitter, Github, Linkedin, Mail } from 'lucide-react';

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-slate-900 border-t border-slate-800 py-12 px-6">
            <div className="max-w-6xl mx-auto">
                <div className="grid md:grid-cols-4 gap-8 mb-8">
                    <div>
                        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-accent-400 mb-4">
                            Streamura
                        </h3>
                        <p className="text-slate-400 text-sm">
                            The next generation of live streaming. Build your community, share your passion,
                            and monetize your content.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Platform</h4>
                        <ul className="space-y-2 text-sm text-slate-400">
                            <li><Link to="/discover" className="hover:text-primary-400 transition-colors">Discover</Link></li>
                            <li><Link to="/features" className="hover:text-primary-400 transition-colors">Features</Link></li>
                            <li><Link to="/pricing" className="hover:text-primary-400 transition-colors">Pricing</Link></li>
                            <li><Link to="/about" className="hover:text-primary-400 transition-colors">About</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Legal</h4>
                        <ul className="space-y-2 text-sm text-slate-400">
                            <li><Link to="/terms" className="hover:text-primary-400 transition-colors">Terms of Service</Link></li>
                            <li><Link to="/privacy" className="hover:text-primary-400 transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/cookies" className="hover:text-primary-400 transition-colors">Cookie Policy</Link></li>
                            <li><Link to="/guidelines" className="hover:text-primary-400 transition-colors">Community Guidelines</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Connect</h4>
                        <div className="flex space-x-4 text-slate-400">
                            <a href="#" className="hover:text-primary-400 transition-colors"><Twitter size={20} /></a>
                            <a href="#" className="hover:text-primary-400 transition-colors"><Github size={20} /></a>
                            <a href="#" className="hover:text-primary-400 transition-colors"><Linkedin size={20} /></a>
                            <Link to="/contact" className="hover:text-primary-400 transition-colors"><Mail size={20} /></Link>
                        </div>
                        <div className="mt-4">
                            <Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">
                                Contact Support
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
                    <p>© {currentYear} Streamura. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link to="/terms" className="hover:text-slate-400 transition-colors">Terms</Link>
                        <Link to="/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link>
                        <Link to="/sitemap" className="hover:text-slate-400 transition-colors">Sitemap</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
