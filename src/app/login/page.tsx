'use client'

import { login, signup } from './actions'
import { useEffect, useState } from 'react'
import { Mail, Lock, User, Send } from 'lucide-react'

export default function LoginPage() {
  const [isRightPanelActive, setIsRightPanelActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('error')) setError(decodeURIComponent(p.get('error')!))
    if (p.get('message')) setMessage(decodeURIComponent(p.get('message')!))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] overflow-hidden p-4 relative">

      {/* ─── Animated Background Graphics (Emails & Shapes) ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Large soft glowing orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />

        {/* Floating Paper Planes / Envelopes */}
        <div className="absolute left-[10%] bottom-[-10%] text-indigo-400/20 bg-anim-1">
          <Send className="w-24 h-24" />
        </div>
        <div className="absolute left-[80%] bottom-[-10%] text-purple-400/20 bg-anim-2">
          <Mail className="w-16 h-16" />
        </div>
        <div className="absolute left-[40%] bottom-[-10%] text-blue-400/20 bg-anim-3">
          <Send className="w-32 h-32" />
        </div>
        <div className="absolute left-[60%] bottom-[-10%] text-indigo-500/10 bg-anim-4">
          <Mail className="w-20 h-20" />
        </div>
        <div className="absolute left-[25%] bottom-[-10%] text-purple-500/15 bg-anim-5">
          <Send className="w-12 h-12" />
        </div>
      </div>

      {/* ─── Main Form Container ─── */}
      {/* Changed bg-white to bg-[#0f172a] (slate-900) */}
      <div className={`relative bg-[#0f172a] rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-800 w-full max-w-[850px] min-h-[550px] overflow-hidden transition-all duration-700 ease-in-out login-container ${isRightPanelActive ? 'right-panel-active' : ''} z-10`}>

        {/* Sign Up Container */}
        {/* Changed bg-white to bg-[#0f172a] */}
        <div className="absolute top-0 left-0 h-full w-1/2 opacity-0 z-10 transition-all duration-700 ease-in-out sign-up-container bg-[#0f172a] px-10 py-12 flex flex-col justify-center items-center text-center">
          <form action={signup} className="w-full max-w-[320px] flex flex-col items-center">
            {/* Changed text colors for dark mode */}
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-sm text-slate-400 mb-8">Enter your details to get started</p>

            <div className="w-full space-y-4 mb-8">
              <div className="relative">
                <User className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" name="name" placeholder="Name" required className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500" />
              </div>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="email" name="email" placeholder="Email" required className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500" />
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="password" name="password" placeholder="Password" minLength={6} required className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500" />
              </div>
            </div>

            <button type="submit" className="bg-[#5b4ebf] text-white text-sm font-semibold tracking-wider uppercase px-12 py-3 rounded-full hover:bg-[#4a3ea3] transition-colors shadow-lg shadow-[#5b4ebf]/30">
              Sign Up
            </button>
          </form>
        </div>

        {/* Sign In Container */}
        {/* Changed bg-white to bg-[#0f172a] */}
        <div className="absolute top-0 left-0 h-full w-1/2 z-20 transition-all duration-700 ease-in-out sign-in-container bg-[#0f172a] px-10 py-12 flex flex-col justify-center items-center text-center">
          <form action={login} className="w-full max-w-[320px] flex flex-col items-center">
            {/* Changed text colors for dark mode */}
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Sign In</h1>
            <p className="text-sm text-slate-400 mb-8">Welcome back to EMAIL AUTOMATION</p>

            {/* Error / Message Banners */}
            {error && (
              <div className="w-full mb-6 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-left">
                {error}
              </div>
            )}
            {message && (
              <div className="w-full mb-6 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-left">
                {message}
              </div>
            )}

            <div className="w-full space-y-4 mb-6">
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="email" name="email" placeholder="Email" required className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500" />
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="password" name="password" placeholder="Password" required className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500" />
              </div>
            </div>

            <a href="#" className="text-sm text-slate-400 hover:text-white mb-8 border-b border-transparent hover:border-white transition-colors">Forgot your password?</a>

            <button type="submit" className="bg-[#5b4ebf] text-white text-sm font-semibold tracking-wider uppercase px-12 py-3 rounded-full hover:bg-[#4a3ea3] transition-colors shadow-lg shadow-[#5b4ebf]/30">
              Sign In
            </button>
          </form>
        </div>

        {/* Overlay Container */}
        <div className="absolute top-0 left-1/2 w-1/2 h-full overflow-hidden transition-transform duration-700 ease-in-out z-[100] overlay-container">
          <div className="bg-gradient-to-br from-[#5b4ebf] to-[#8a63e5] relative -left-full h-full w-[200%] transform transition-transform duration-700 ease-in-out overlay text-white shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">

            {/* Overlay Left (Sign In Panel shown when Sign Up is active) */}
            <div className="absolute flex flex-col items-center justify-center px-12 text-center top-0 h-full w-1/2 transform transition-transform duration-700 ease-in-out overlay-left">
              <h1 className="text-4xl font-bold mb-4">Welcome Back!</h1>
              <p className="text-indigo-100 mb-8 font-light leading-relaxed max-w-[280px]">
                To keep connected with us please login with your personal info
              </p>
              <button
                onClick={() => setIsRightPanelActive(false)}
                className="bg-transparent border-2 border-white text-white text-sm font-semibold tracking-wider uppercase px-12 py-3 rounded-full hover:bg-white hover:text-[#5b4ebf] transition-all"
              >
                Sign In
              </button>
            </div>

            {/* Overlay Right (Sign Up Panel shown when Sign In is active) */}
            <div className="absolute flex flex-col items-center justify-center px-12 text-center top-0 h-full w-1/2 transform transition-transform duration-700 ease-in-out right-0 overlay-right">
              <h1 className="text-4xl font-bold mb-4">Hello, Friend!</h1>
              <p className="text-indigo-100 mb-8 font-light leading-relaxed max-w-[280px]">
                Enter your personal details and start your journey with us
              </p>
              <button
                onClick={() => setIsRightPanelActive(true)}
                className="bg-transparent border-2 border-white text-white text-sm font-semibold tracking-wider uppercase px-12 py-3 rounded-full hover:bg-white hover:text-[#5b4ebf] transition-all"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Internal CSS for the sliding animation & background magic */}
      <style>{`
        /* --- Background Animations --- */
        @keyframes floatUpRight {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-120vh) translateX(200px) rotate(45deg); opacity: 0; }
        }
        @keyframes floatUpLeft {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-120vh) translateX(-200px) rotate(-45deg); opacity: 0; }
        }

        .bg-anim-1 { animation: floatUpRight 15s infinite linear; }
        .bg-anim-2 { animation: floatUpLeft 22s infinite linear 4s; }
        .bg-anim-3 { animation: floatUpRight 18s infinite linear 8s; }
        .bg-anim-4 { animation: floatUpLeft 25s infinite linear 12s; }
        .bg-anim-5 { animation: floatUpRight 20s infinite linear 16s; }


        /* --- Sliding Panels --- */
        /* Sign In container moves out of the way */
        .login-container.right-panel-active .sign-in-container {
          transform: translateX(100%);
        }

        /* Sign Up container moves into view and becomes active */
        .login-container.right-panel-active .sign-up-container {
          transform: translateX(100%);
          opacity: 1;
          z-index: 50;
          animation: show 0.7s;
        }

        /* The wrapper for the overlay moves left */
        .login-container.right-panel-active .overlay-container {
          transform: translateX(-100%);
        }

        /* The overlay background gradient moves right to counter the wrapper */
        .login-container.right-panel-active .overlay {
          transform: translateX(50%);
        }

        /* Overlay Left text panel moves into view */
        .overlay-left {
          transform: translateX(-20%);
        }
        .login-container.right-panel-active .overlay-left {
          transform: translateX(0);
        }

        /* Overlay Right text panel moves out of view */
        .overlay-right {
          transform: translateX(0);
        }
        .login-container.right-panel-active .overlay-right {
          transform: translateX(20%);
        }

        @keyframes show {
          0%, 49.99% {
            opacity: 0;
            z-index: 10;
          }
          50%, 100% {
            opacity: 1;
            z-index: 50;
          }
        }
      `}</style>
    </div>
  )
}
