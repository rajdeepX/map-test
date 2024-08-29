import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Wrapper } from "@googlemaps/react-wrapper";
import { getGeocode, getLatLng } from "use-places-autocomplete";
import { CatmullRomCurve3, Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import ThreeJSOverlayView from "@ubilabs/threejs-overlay-view";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// import { useGLTF } from "@react-three/drei";

const mapOptions = {
  mapId: import.meta.env.VITE_REACT_APP_MAP_ID,
  // center: { lat: 43.66293, lng: -79.39314 },
  center: { lat: 26.1538, lng: 91.7825 },
  zoom: 18,
  disableDefaultUI: true,
  heading: 25,
  tilt: 60,
};

export default function App() {
  return (
    <>
      <Wrapper apiKey={import.meta.env.VITE_REACT_APP_MAP_API_KEY}>
        <MyMap />
      </Wrapper>
    </>
  );
}

function MyMap() {
  const [route, setRoute] = useState();
  const [map, setMap] = useState();
  const ref = useRef();

  useEffect(() => {
    setMap(new window.google.maps.Map(ref.current, mapOptions));
  }, []);

  return (
    <>
      <div ref={ref} id="map" />
      {map && <Direction setRoute={setRoute} />}
      {map && route && <Animation map={map} route={route} />}
    </>
  );
}

const ANIMATION_MS = 10000;
const FRONT_VECTOR = new Vector3(0, -1, 0);

function Animation({ map, route }) {
  const overlayRef = useRef();
  const trackRef = useRef();
  const carRef = useRef();

  useEffect(() => {
    map.setCenter(route[Math.floor(route.length / 2)], 17);

    if (!overlayRef.current) {
      overlayRef.current = new ThreeJSOverlayView(mapOptions.center);
      overlayRef.current.setMap(map);
    }

    const scene = overlayRef.current.getScene();
    const points = route.map((p) => overlayRef.current.latLngAltToVector3(p));
    const curve = new CatmullRomCurve3(points);

    // TRACK
    if (trackRef.current) {
      scene.remove(trackRef.current);
    }

    trackRef.current = createTrackFromCurve(curve);
    scene.add(trackRef.current);

    // MODEL
    loadModel().then((model) => {
      if (carRef.current) {
        scene.remove(carRef.current);
      }
      carRef.current = model;
      scene.add(carRef.current);
    });

    overlayRef.current.update = () => {
      trackRef.current.material.resolution.copy(
        overlayRef.current.getViewportSize()
      );

      if (carRef.current) {
        const progress = (performance.now() % ANIMATION_MS) / ANIMATION_MS;
        curve.getPointAt(progress, carRef.current.position);
        carRef.current.quaternion.setFromUnitVectors(
          FRONT_VECTOR,
          curve.getTangentAt(progress)
        );
        carRef.current.rotateX(Math.PI / 2);
        carRef.current.rotateY(Math.PI / 2);
      }
      overlayRef.current.requestRedraw();
    };

    return () => {
      scene.remove(trackRef.current);
      scene.remove(carRef.current);
    };
  }, [route]);

  return null;
}

async function loadModel() {
  const loader = new GLTFLoader();

  // This work is based on "Low Poly Walking Man!" (https://skfb.ly/owOtU) by ROB 3D is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).

  // This work is based on "Low Poly Walking Man!" (https://sketchfab.com/3d-models/low-poly-walking-man-716510751ebc4b3a9b8b9014a5d710ed) by ROB 3D (https://sketchfab.com/Robertcucui2) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

  // const object = await loader.loadAsync("/low_poly_car/scene.gltf");
  const object = await loader.loadAsync("/car/scene.gltf");
  const scene = object.scene;
  scene.scale.setScalar(0.02);
  return scene;
}

// async function loadModel() {
//   const loader = new GLTFLoader();
//   // This work is based on "Low poly Car" (https://sketchfab.com/3d-models/low-poly-car-f822f0c500a24ca9ac2af183d2e630b4) by reyad.bader (https://sketchfab.com/reyad.bader) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
//   // const object = await loader.loadAsync("/low_poly_car/scene.gltf");
//   const object = await loader.load("/low_poly_car/scene.gltf");
//   const group = object.scene;
//   group.scale.setScalar(0.5);

//   return group;
// }

function createTrackFromCurve(curve) {
  const points = curve.getSpacedPoints(curve.points.length * 10);
  const positions = points.map((point) => point.toArray()).flat();

  return new Line2(
    new LineGeometry().setPositions(positions),
    new LineMaterial({
      color: 0xffb703,
      linewidth: 8,
    })
  );
}

function Direction({ setRoute }) {
  const [origin] = useState("RG Baruah Rd Guwahati");
  const [destination] = useState("Japorigog Guwahati");
  // const [origin] = useState("475 Yonge St Toronto");
  // const [destination] = useState("50 St Joseph St Toronto");

  useEffect(() => {
    fetchDirections(origin, destination, setRoute);
  }, [origin, destination]);

  return (
    <div className="directions">
      <h2>Directions</h2>
      <h3>Origin</h3>
      <p>{origin}</p>
      <h3>Destination</h3>
      <p>{destination}</p>
    </div>
  );
}

async function fetchDirections(origin, destination, setRoute) {
  const [originResults, destinationResults] = await Promise.all([
    getGeocode({ address: origin }),
    getGeocode({ address: destination }),
  ]);

  const [originLocation, destinationLocation] = await Promise.all([
    getLatLng(originResults[0]),
    getLatLng(destinationResults[0]),
  ]);

  const service = new google.maps.DirectionsService();
  service.route(
    {
      origin: originLocation,
      destination: destinationLocation,
      travelMode: google.maps.TravelMode.DRIVING,
    },
    (result, status) => {
      if (status === "OK" && result) {
        const route = result.routes[0].overview_path.map((path) => ({
          lat: path.lat(),
          lng: path.lng(),
        }));

        setRoute(route);
      }
    }
  );
}
