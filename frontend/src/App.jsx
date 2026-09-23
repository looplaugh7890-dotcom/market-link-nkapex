import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HealthCheck from './pages/HealthCheck';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HealthCheck />} />
      </Routes>
    </Router>
  );
}

export default App;
