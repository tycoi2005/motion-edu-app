import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import { PoseProvider } from './cv/poseContext'

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <PoseProvider>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </div>
      </PoseProvider>
    </BrowserRouter>
  )
}

export default App
