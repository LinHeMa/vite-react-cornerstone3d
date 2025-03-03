import TutorialViewer from "./components/tutorial/TutorialViewer"
import VolumeViewer from "./components/volume/VolumeViewer"
import FineTest from "./components/fineTest/FineTest"
import { BrowserRouter } from "react-router"
import { Routes } from "react-router"
import { Route } from "react-router"
import Home from "./components/home/Home"
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/fine-test" element={<FineTest />} />
        <Route path="/tutorial" element={<TutorialViewer />} />
        <Route path="/volume" element={<VolumeViewer />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
