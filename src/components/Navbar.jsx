import React from 'react'
import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-gradient-to-r from-primary to-secondary shadow-xl backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-18">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-white/30 transition-all duration-300">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z"/>
              </svg>
            </div>
            <span className="text-white text-2xl font-bold tracking-wide group-hover:text-gray-100 transition-colors">SkyLENS</span>
          </Link>
          <div className="flex space-x-2">
            <Link 
              to="/" 
              className="text-white hover:text-gray-200 px-4 py-2 rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all duration-300 font-medium"
            >
              Home
            </Link>
            <Link 
              to="/location/Jalan%20Radio" 
              className="text-white hover:text-gray-200 px-4 py-2 rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all duration-300 font-medium"
            >
              Jalan Radio
            </Link>
            <Link 
              to="/location/Baleendah" 
              className="text-white hover:text-gray-200 px-4 py-2 rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all duration-300 font-medium"
            >
              Baleendah
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
