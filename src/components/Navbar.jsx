import React from 'react'
import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-primary shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-3">
            <span className="text-white text-xl font-bold">SkyLENS</span>
          </Link>
          <div className="flex space-x-4">
            <Link to="/" className="text-white hover:text-gray-200">Home</Link>
            <Link to="/location/Jalan%20Radio" className="text-white hover:text-gray-200">Jalan Radio</Link>
            <Link to="/location/Baleendah" className="text-white hover:text-gray-200">Baleendah</Link>
          </div>
        </div>
      </div>
    </nav>
  )
}