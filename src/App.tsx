import { HashRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home/Home';
import Lobby from './pages/Lobby/Lobby';
import Arena from './pages/Arena/Arena';
import './App.scss';

function App() {
  return (
    <HashRouter>
      <div className="app">
        <Navbar />
        <main className="app__content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/arena" element={<Arena />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
