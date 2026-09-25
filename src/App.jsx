import { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import heroCarImage from './assets/abstract-car-silhouette.png';

// --- Firebase Setup (unchanged) ---
const firebaseConfig = {
  apiKey: "AIzaSyC1h9JcKS1rVo5YbaSpdbzcx8SLph-KzCM",
  authDomain: "fuel-mpg-tracker.firebaseapp.com",
  projectId: "fuel-mpg-tracker",
  storageBucket: "fuel-mpg-tracker.firebasestorage.app",
  messagingSenderId: "60966261492",
  appId: "1:60966261492:web:68cb0473a22702097e44a1",
  measurementId: "G-B5E9P6R4XF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- Inline SVG icons (verbatim path data from the mockup) ---
function Icon({ className = 'icon', children, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...rest}>{children}</svg>
  );
}

const ICONS = {
  plus: <path d="M12 5v14M5 12h14" />,
  car: (<>
    <path d="M4 16l1.8-5.2A2 2 0 0 1 7.7 9h8.6a2 2 0 0 1 1.9 1.8L20 16" />
    <path d="M5 16h14v3H5z" />
    <path d="M7 19v2M17 19v2M7.5 14h.01M16.5 14h.01" />
  </>),
  carPlain: (<>
    <path d="M4 16l1.8-5.2A2 2 0 0 1 7.7 9h8.6a2 2 0 0 1 1.9 1.8L20 16" />
    <path d="M5 16h14v3H5z" />
    <path d="M7 19v2M17 19v2" />
  </>),
  book: <path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4" />,
  swap: <path d="M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3" />,
  dots: (<>
    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </>),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  fuel: <path d="M4 21V5l2-2h8l2 2v16M4 10h12M7 6h6M16 8h3l2 3v7a2 2 0 0 1-4 0v-4" />,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-3-3z" />,
  bolt: <path d="M13 3l-2 7h6l-7 11 2-8H6z" />,
  edit: (<>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
  </>),
  trash: <path d="M3 6h18M8 6V4h8v2M7 6l1 15h8l1-15M10 10v7M14 10v7" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />,
};

const KIND_ICONS = { fuel: ICONS.fuel, service: ICONS.wrench, mods: ICONS.bolt };

// --- Formatting helpers (same behavior as the mockup) ---
function formatDate(value) {
  if (!value) return '—';
  const parts = String(value).split('-');
  return Number(parts[1]) + '/' + Number(parts[2]) + '/' + parts[0];
}

function formatShortDate(value) {
  if (!value) return 'No date';
  const date = new Date(value + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

// Centered moving average: damps fill-up noise so the MPG trend stays readable as entries pile up.
function smoothSeries(values, windowSize) {
  const half = Math.floor(windowSize / 2);
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j += 1) {
      if (j >= 0 && j < values.length) {
        sum += values[j];
        count += 1;
      }
    }
    return sum / count;
  });
}

// Catmull-Rom spline through the points, emitted as cubic Bezier segments for the SVG path.
function smoothLinePath(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1) + 'L' + pts[1].x.toFixed(1) + ' ' + pts[1].y.toFixed(1);
  let d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += 'C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
  }
  return d;
}

function formatMoney(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildVehicleName(vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
}

function newDocId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parseCsvLine(line) {
  const result = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { value += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { result.push(value); value = ''; }
    else value += ch;
  }
  result.push(value);
  return result;
}

function columnsFor(filter) {
  if (filter === 'fuel') return [{ key: 'date', label: 'Date' }, { key: 'odometer', label: 'Odometer' }, { key: 'gallons', label: 'Gallons' }, { key: 'cost', label: 'Cost' }, { key: 'mpg', label: 'MPG' }, { key: 'notes', label: 'Notes' }];
  if (filter === 'service') return [{ key: 'date', label: 'Date' }, { key: 'mileage', label: 'Mileage' }, { key: 'service', label: 'Service' }, { key: 'performedBy', label: 'Performed By' }, { key: 'notes', label: 'Notes' }];
  if (filter === 'mods') return [{ key: 'date', label: 'Date' }, { key: 'mileage', label: 'Mileage' }, { key: 'part', label: 'Mod Type / Part' }, { key: 'specs', label: 'Brand / Model / Specs' }, { key: 'notes', label: 'Notes' }];
  return [{ key: 'date', label: 'Date' }, { key: 'kind', label: 'Type' }, { key: 'summary', label: 'Entry' }, { key: 'mileage', label: 'Mileage' }];
}

function getSortValue(entry, key) {
  if (key === 'odometer') return Number(entry.odo || 0);
  if (key === 'gallons') return Number(entry.volume || 0);
  if (key === 'cost') return (Number(entry.volume) || 0) * (Number(entry.unitPrice) || 0);
  if (key === 'mpg') return entry.mpg == null ? -1 : entry.mpg;
  if (key === 'service') return (entry.service || '').toLowerCase();
  if (key === 'performedBy') return (entry.performedBy || '').toLowerCase();
  if (key === 'part') return (entry.part || '').toLowerCase();
  if (key === 'specs') return (entry.specs || '').toLowerCase();
  return entry[key] == null ? '' : entry[key];
}

function sortEntries(entries, sortState) {
  return entries.slice().sort((a, b) => {
    const av = getSortValue(a, sortState.key);
    const bv = getSortValue(b, sortState.key);
    const result = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortState.direction === 'asc' ? result : -result;
  });
}

function emptyStateText(filter) {
  if (filter === 'fuel') return 'No fill-ups found for this page/vehicle.';
  if (filter === 'mods') return 'No mods logged yet for this vehicle.';
  if (filter === 'service') return 'No maintenance entries found for this page/vehicle.';
  return 'No logbook entries found for this vehicle.';
}

const EMPTY_FUEL_DRAFT = { date: '', odo: '', gallons: '', price: '', notes: '' };
const EMPTY_SERVICE_DRAFT = { date: '', odo: '', name: '', by: '', notes: '' };
const EMPTY_MOD_DRAFT = { date: '', odo: '', name: '', specs: '', notes: '' };
const EMPTY_VEHICLE_DRAFT = { year: '', make: '', model: '', nickname: '', trim: '', color: '', vin: '', purchaseDate: '', purchaseMileage: '', purchasePrice: '', note: '' };

export default function App() {
  const [user, setUser] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);

  // --- Firestore data (field names identical to the original data layer) ---
  const [vehicles, setVehicles] = useState([]);
  const [activeVehicleId, setActiveVehicleId] = useState('');
  const [logs, setLogs] = useState([]);
  const [mods, setMods] = useState([]);
  const [maintenance, setMaintenance] = useState([]);

  // --- View state (mirrors the mockup's script) ---
  const [activeScreen, setActiveScreen] = useState('garage');
  const [currentFilter, setCurrentFilter] = useState('all');
  const [sortState, setSortState] = useState({ key: 'date', direction: 'desc' });
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [quickAdd, setQuickAdd] = useState({ open: false, form: null, editing: false, editingId: null });
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [vehicleEditor, setVehicleEditor] = useState({ open: false, mode: 'add' });
  const [csv, setCsv] = useState({ open: false, status: 'ready', message: 'Ready to import' });
  const [logDelete, setLogDelete] = useState({ open: false, ids: [] });

  const [fuelDraft, setFuelDraft] = useState(EMPTY_FUEL_DRAFT);
  const [serviceDraft, setServiceDraft] = useState(EMPTY_SERVICE_DRAFT);
  const [modDraft, setModDraft] = useState(EMPTY_MOD_DRAFT);
  const [vehicleDraft, setVehicleDraft] = useState(EMPTY_VEHICLE_DRAFT);

  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef(null);

  const manageButtonRef = useRef(null);
  const manageMenuRef = useRef(null);
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const tooltipRef = useRef(null);
  const crosshairRef = useRef(null);
  const selectAllRef = useRef(null);
  const mobileSelectAllRef = useRef(null);

  function showToast(message) {
    setToastMsg(message);
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2400);
  }

  // --- Auth (unchanged) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setDbLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // --- Firestore subscriptions (unchanged collections) ---
  useEffect(() => {
    if (!user) return;
    const refs = [
      onSnapshot(collection(db, 'users', user.uid, 'vehicles'), (s) => setVehicles(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error('Error fetching vehicles:', e)),
      onSnapshot(collection(db, 'users', user.uid, 'logs'), (s) => setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error('Error fetching logs:', e)),
      onSnapshot(collection(db, 'users', user.uid, 'mods'), (s) => setMods(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error('Error fetching mods:', e)),
      onSnapshot(collection(db, 'users', user.uid, 'maintenance'), (s) => setMaintenance(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error('Error fetching maintenance:', e)),
    ];
    return () => refs.forEach((u) => u());
  }, [user]);

  const uid = user ? user.uid : null;

  // --- Derived data ---
  const activeVehicle = useMemo(() => {
    if (activeVehicleId && vehicles.some((v) => v.id === activeVehicleId)) {
      return vehicles.find((v) => v.id === activeVehicleId);
    }
    return vehicles[0] || null;
  }, [vehicles, activeVehicleId]);

  const activeVehicleName = activeVehicle ? buildVehicleName(activeVehicle) : 'No vehicles in garage';

  // Fuel logs for the active vehicle with MPG derived exactly per spec:
  // sort chronologically by (date, odo); distance = odo delta; mpg = distance/volume;
  // null for first fill, missing values, or non-positive distance.
  const vehicleFuelLogs = useMemo(() => {
    if (!activeVehicle) return [];
    const mine = logs.filter((l) => l.vehicleId === activeVehicle.id);
    const sorted = [...mine].sort((a, b) => {
      const d = String(a.date || '').localeCompare(String(b.date || ''));
      if (d !== 0) return d;
      return (Number(a.odo) || 0) - (Number(b.odo) || 0);
    });
    return sorted.map((log, i) => {
      if (i === 0 || !log.odo || !log.volume) return { ...log, distance: 0, mpg: null };
      const prev = sorted[i - 1];
      if (!prev.odo) return { ...log, distance: 0, mpg: null };
      const distance = Number(log.odo) - Number(prev.odo);
      if (distance <= 0) return { ...log, distance, mpg: null };
      return { ...log, distance, mpg: distance / Number(log.volume) };
    });
  }, [logs, activeVehicle]);

  const latestOdoText = useMemo(() => {
    const sorted = vehicleFuelLogs.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return sorted.length && sorted[0].odo ? formatNumber(sorted[0].odo) : '0';
  }, [vehicleFuelLogs]);

  // Unified timeline entries (mockup's demo `logs` array shapes, wired to real data)
  const timelineEntries = useMemo(() => {
    if (!activeVehicle) return [];
    const vid = activeVehicle.id;
    const fuels = vehicleFuelLogs.map((l) => ({ ...l, kind: 'fuel' }));
    const services = maintenance
      .filter((m) => m.vehicleId === vid)
      .map((m) => ({ ...m, kind: 'service', service: m.service || m.item || '', performedBy: m.performedBy || m.performer || '' }));
    const modEntries = mods
      .filter((m) => m.vehicleId === vid)
      .map((m) => ({ ...m, kind: 'mods', part: m.category || '', specs: m.specs || '' }));
    return [...fuels, ...services, ...modEntries];
  }, [vehicleFuelLogs, maintenance, mods, activeVehicle]);

  const displayedEntries = useMemo(() => {
    if (currentFilter === 'all') {
      return timelineEntries.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    }
    return sortEntries(timelineEntries.filter((e) => e.kind === currentFilter), sortState);
  }, [timelineEntries, currentFilter, sortState]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(displayedEntries.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const visibleEntries = pageSize === 'all' ? displayedEntries : displayedEntries.slice((safePage - 1) * pageSize, safePage * pageSize);

  const recentEntries = useMemo(
    () => timelineEntries.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 3),
    [timelineEntries]
  );

  // Fuel stats (same math as the mockup's renderFuelStats)
  const fuelStats = useMemo(() => {
    const fuels = vehicleFuelLogs.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const mpgRows = fuels.filter((e) => e.mpg != null);
    const avg = mpgRows.length ? mpgRows.reduce((s, e) => s + e.mpg, 0) / mpgRows.length : 0;
    const best = mpgRows.length ? Math.max(...mpgRows.map((e) => e.mpg)) : 0;
    const total = fuels.reduce((s, e) => s + (Number(e.volume) || 0) * (Number(e.unitPrice) || 0), 0);
    const bestEntry = mpgRows.find((e) => e.mpg === best);
    return { avg, best, total, hasRows: mpgRows.length > 0, bestDate: bestEntry ? formatDate(bestEntry.date) : 'No MPG values yet' };
  }, [vehicleFuelLogs]);

  // MPG chart points (only when >= 2 MPG points)
  const chartPoints = useMemo(
    () => vehicleFuelLogs.filter((e) => e.mpg != null).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))),
    [vehicleFuelLogs]
  );

  const chart = useMemo(() => {
    if (chartPoints.length < 2) return null;
    const width = 720;
    const left = 58;
    const right = 690;
    const top = 38;
    const bottom = 248;
    const n = chartPoints.length;
    const max = Math.max(...chartPoints.map((p) => p.mpg)) + 10;
    const x = (i) => (n === 1 ? (left + right) / 2 : left + ((right - left) * i) / (n - 1));
    const y = (v) => bottom - (v / max) * (bottom - top);
    // Smooth the trend with a widening moving-average window as entries accumulate,
    // then draw it as a spline instead of a jagged polyline.
    const windowSize = n >= 15 ? 5 : n >= 7 ? 3 : 1;
    const trend = smoothSeries(
      chartPoints.map((p) => p.mpg),
      windowSize
    );
    const line = smoothLinePath(chartPoints.map((p, i) => ({ x: x(i), y: y(trend[i]) })));
    const area = line + 'L' + x(n - 1).toFixed(1) + ' ' + bottom + 'L' + x(0).toFixed(1) + ' ' + bottom + 'Z';
    const grid = [max, (max * 2) / 3, max / 3, 0].map((v, i) => {
      const yy = top + ((bottom - top) * i) / 3;
      return { y: yy, label: v.toFixed(i === 3 ? 0 : 1) };
    });
    // Dots are gone from the render — hover/touch snaps to each fill-up by x-coordinate,
    // and the tooltip keeps showing the entry's actual recorded MPG.
    const dots = chartPoints.map((p, i) => ({ cx: x(i).toFixed(1), cy: y(trend[i]).toFixed(1), date: p.date, mpg: p.mpg.toFixed(2) }));
    return { width, left, right, top, bottom, line, area, grid, dots, first: formatDate(chartPoints[0].date), last: formatDate(chartPoints[chartPoints.length - 1].date) };
  }, [chartPoints]);

  const chartAvg = useMemo(
    () => (chartPoints.length ? (chartPoints.reduce((s, p) => s + p.mpg, 0) / chartPoints.length).toFixed(1) : null),
    [chartPoints]
  );

  // --- Screen / filter navigation (mirrors the mockup) ---
  function setScreen(name) {
    setActiveScreen(name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function applyLogFilter(filter) {
    setCurrentFilter(filter);
    setCurrentPage(1);
    setSelectedIds(new Set());
    setScreen('logbook');
    setSortState({ key: 'date', direction: 'desc' });
  }

  // --- Quick-add sheet ---
  function resetEntryForms() {
    setFuelDraft(EMPTY_FUEL_DRAFT);
    setServiceDraft(EMPTY_SERVICE_DRAFT);
    setModDraft(EMPTY_MOD_DRAFT);
  }

  function openQuickAdd(formName, isEdit, editId) {
    if (!activeVehicle) {
      showToast('Add a vehicle before logging an entry');
      return;
    }
    if (isEdit && editId) {
      prefillEdit(editId);
    } else {
      resetEntryForms();
      setQuickAdd({ open: true, form: formName || null, editing: false, editingId: null });
    }
  }

  function closeQuickAdd() {
    setQuickAdd({ open: false, form: null, editing: false, editingId: null });
  }

  function backToChooser() {
    resetEntryForms();
    setQuickAdd({ open: true, form: null, editing: false, editingId: null });
  }

  function prefillEdit(id) {
    const entry = timelineEntries.find((item) => item.id === id);
    if (!entry) return;
    resetEntryForms();
    const formName = entry.kind === 'mods' ? 'mod' : entry.kind;
    if (formName === 'fuel') {
      setFuelDraft({ date: entry.date || '', odo: entry.odo ?? '', gallons: entry.volume ?? '', price: entry.unitPrice ?? '', notes: entry.notes || '' });
    } else if (formName === 'service') {
      setServiceDraft({ date: entry.date || '', odo: entry.mileage ?? '', name: entry.service || '', by: entry.performedBy || '', notes: entry.notes || '' });
    } else {
      setModDraft({ date: entry.date || '', odo: entry.mileage ?? '', name: entry.part || '', specs: entry.specs || '', notes: entry.notes || '' });
    }
    setQuickAdd({ open: true, form: formName, editing: true, editingId: id });
  }

  async function handleQuickSubmit(e) {
    e.preventDefault();
    if (!uid || !activeVehicle) return;
    const form = quickAdd.form;
    const editingId = quickAdd.editingId;
    if (form === 'fuel') {
      const volume = Number(fuelDraft.gallons);
      const unitPrice = Number(fuelDraft.price);
      const payload = {
        vehicleId: activeVehicle.id,
        date: fuelDraft.date,
        odo: Number(fuelDraft.odo),
        volume,
        unitPrice,
        total: volume * unitPrice,
        notes: fuelDraft.notes.trim(),
      };
      const id = editingId || newDocId('log-');
      await setDoc(doc(db, 'users', uid, 'logs', id), payload);
    } else if (form === 'service') {
      const payload = {
        vehicleId: activeVehicle.id,
        date: serviceDraft.date,
        mileage: Number(serviceDraft.odo),
        service: serviceDraft.name.trim(),
        item: serviceDraft.name.trim(),
        performedBy: serviceDraft.by.trim(),
        performer: serviceDraft.by.trim(),
        notes: serviceDraft.notes.trim(),
        updatedAt: new Date().toISOString(),
      };
      const id = editingId || newDocId('log-');
      await setDoc(doc(db, 'users', uid, 'maintenance', id), payload);
    } else {
      const id = editingId || newDocId('log-');
      if (editingId) {
        await setDoc(
          doc(db, 'users', uid, 'mods', id),
          {
            date: modDraft.date,
            mileage: Number(modDraft.odo) || 0,
            category: modDraft.name.trim(),
            specs: modDraft.specs.trim(),
            notes: modDraft.notes.trim(),
          },
          { merge: true }
        );
      } else {
        await setDoc(doc(db, 'users', uid, 'mods', id), {
          vehicleId: activeVehicle.id,
          date: modDraft.date,
          mileage: Number(modDraft.odo) || 0,
          category: modDraft.name.trim(),
          specs: modDraft.specs.trim(),
          notes: modDraft.notes.trim(),
          createdAt: new Date().toISOString(),
        });
      }
    }
    closeQuickAdd();
    resetEntryForms();
    showToast(editingId ? 'Entry updated' : 'Entry added');
    applyLogFilter(form === 'mod' ? 'mods' : form);
  }

  // --- Vehicle picker ---
  function setVehicle(id, silent) {
    setActiveVehicleId(id);
    setVehiclePickerOpen(false);
    const v = vehicles.find((x) => x.id === id);
    if (!silent && v) showToast(buildVehicleName(v) + ' is now active');
  }

  // --- Vehicle manage menu ---
  function openVehicleManage() {
    if (!activeVehicle) return;
    setDeleteConfirmVisible(false);
    if (window.innerWidth > 720 && manageButtonRef.current && manageMenuRef.current) {
      const rect = manageButtonRef.current.getBoundingClientRect();
      const menuWidth = 292;
      manageMenuRef.current.style.top = Math.min(window.innerHeight - 260, rect.bottom + 8) + 'px';
      manageMenuRef.current.style.left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth)) + 'px';
    } else if (manageMenuRef.current) {
      manageMenuRef.current.style.top = '';
      manageMenuRef.current.style.left = '';
    }
    setManageOpen(true);
  }

  function closeVehicleManage() {
    setManageOpen(false);
    setDeleteConfirmVisible(false);
  }

  async function confirmDeleteVehicle() {
    if (!uid || !activeVehicle) return;
    const vid = activeVehicle.id;
    const name = activeVehicleName;
    await deleteDoc(doc(db, 'users', uid, 'vehicles', vid));
    await Promise.all([
      ...logs.filter((l) => l.vehicleId === vid).map((l) => deleteDoc(doc(db, 'users', uid, 'logs', l.id))),
      ...mods.filter((m) => m.vehicleId === vid).map((m) => deleteDoc(doc(db, 'users', uid, 'mods', m.id))),
      ...maintenance.filter((m) => m.vehicleId === vid).map((m) => deleteDoc(doc(db, 'users', uid, 'maintenance', m.id))),
    ]);
    closeVehicleManage();
    showToast(name + ' was deleted');
  }

  // --- Vehicle editor ---
  function openVehicleEditor(mode) {
    closeVehicleManage();
    setVehiclePickerOpen(false);
    setVehicleEditor({ open: true, mode });
    if (mode === 'edit' && activeVehicle) {
      setVehicleDraft({
        year: activeVehicle.year || '',
        make: activeVehicle.make || '',
        model: activeVehicle.model || '',
        nickname: activeVehicle.nickname || '',
        trim: activeVehicle.trim || '',
        color: activeVehicle.color || '',
        vin: activeVehicle.vin || '',
        purchaseDate: activeVehicle.purchaseDate || '',
        purchaseMileage: activeVehicle.purchaseMileage ?? '',
        purchasePrice: activeVehicle.purchasePrice ?? '',
        note: activeVehicle.note || '',
      });
    } else {
      setVehicleDraft(EMPTY_VEHICLE_DRAFT);
    }
  }

  function closeVehicleEditor() {
    setVehicleEditor({ open: false, mode: 'add' });
  }

  async function handleVehicleSubmit(e) {
    e.preventDefault();
    if (!uid) return;
    const data = {
      year: vehicleDraft.year.trim(),
      make: vehicleDraft.make.trim(),
      model: vehicleDraft.model.trim(),
      nickname: vehicleDraft.nickname.trim(),
      trim: vehicleDraft.trim.trim(),
      color: vehicleDraft.color.trim(),
      vin: vehicleDraft.vin.trim().toUpperCase(),
      purchaseDate: vehicleDraft.purchaseDate,
      purchaseMileage: vehicleDraft.purchaseMileage,
      purchasePrice: vehicleDraft.purchasePrice,
      note: vehicleDraft.note.trim(),
    };
    if (vehicleEditor.mode === 'edit' && activeVehicle) {
      await setDoc(doc(db, 'users', uid, 'vehicles', activeVehicle.id), data, { merge: true });
      closeVehicleEditor();
      showToast('Vehicle details updated');
    } else {
      const id = newDocId('vehicle-');
      await setDoc(doc(db, 'users', uid, 'vehicles', id), data, { merge: true });
      setActiveVehicleId(id);
      closeVehicleEditor();
      showToast(buildVehicleName(data) + ' was added');
    }
  }

  // --- Logbook interactions ---
  function handleSort(key) {
    setSortState((prev) => (prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }));
    setCurrentPage(1);
    setSelectedIds(new Set());
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectPage(checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleEntries.forEach((entry) => {
        if (checked) next.add(entry.id);
        else next.delete(entry.id);
      });
      return next;
    });
  }

  const pageSelectedCount = visibleEntries.filter((e) => selectedIds.has(e.id)).length;
  const allPageSelected = visibleEntries.length > 0 && pageSelectedCount === visibleEntries.length;

  useEffect(() => {
    [selectAllRef.current, mobileSelectAllRef.current].forEach((el) => {
      if (el) {
        el.checked = allPageSelected;
        el.indeterminate = pageSelectedCount > 0 && pageSelectedCount < visibleEntries.length;
      }
    });
  });

  function openLogDelete(ids) {
    setLogDelete({ open: true, ids });
  }

  function closeLogDelete() {
    setLogDelete({ open: false, ids: [] });
  }

  async function confirmLogDelete() {
    if (!uid) return;
    const ids = logDelete.ids;
    const byKind = { fuel: 'logs', service: 'maintenance', mods: 'mods' };
    await Promise.all(
      ids.map((id) => {
        const entry = timelineEntries.find((e) => e.id === id);
        const col = entry ? byKind[entry.kind] : 'logs';
        return deleteDoc(doc(db, 'users', uid, col, id));
      })
    );
    const count = ids.length;
    setSelectedIds(new Set());
    closeLogDelete();
    showToast(count + (count === 1 ? ' entry was' : ' entries were') + ' deleted');
  }

  function handlePageSizeChange(value) {
    setPageSize(value === 'all' ? 'all' : Number(value));
    setCurrentPage(1);
  }

  // --- CSV import ---
  function downloadCsvTemplate() {
    const blob = new Blob(['Date,Odometer,Gallons,PricePerGal,Notes\n2023-10-01,45000,12.5,3.50,First import log\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fuel-log-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleCsvUpload(e) {
    const file = e.target.files[0];
    if (!file || !uid || !activeVehicle) return;
    setCsv({ open: true, status: 'importing', message: 'Importing...' });
    const reader = new FileReader();
    reader.onload = () => {
      setTimeout(async () => {
        try {
          const lines = String(reader.result).trim().split(/\r?\n/);
          const headers = parseCsvLine(lines.shift()).map((v) => v.trim());
          const expected = ['Date', 'Odometer', 'Gallons', 'PricePerGal', 'Notes'];
          if (expected.some((v, i) => headers[i] !== v)) throw new Error('Use the provided template headers.');
          let count = 0;
          for (const line of lines) {
            if (!line.trim()) continue;
            const row = parseCsvLine(line);
            let date = (row[0] || '').trim();
            if (date.includes('/')) {
              const parts = date.split('/');
              if (parts.length === 3) {
                const m = parts[0].padStart(2, '0');
                const d = parts[1].padStart(2, '0');
                const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                date = `${y}-${m}-${d}`;
              }
            }
            const volume = parseFloat(row[2]) || 0;
            const unitPrice = parseFloat(row[3]) || 0;
            const payload = {
              vehicleId: activeVehicle.id,
              date,
              odo: parseFloat(row[1]) || 0,
              volume,
              unitPrice,
              total: volume * unitPrice,
              notes: (row[4] || '').trim(),
            };
            await setDoc(doc(db, 'users', uid, 'logs', newDocId('fuel-') + '-' + count), payload);
            count++;
          }
          setCsv({ open: true, status: 'success', message: 'Import Complete!' });
          showToast(count + ' fuel ' + (count === 1 ? 'entry' : 'entries') + ' imported');
        } catch (error) {
          setCsv({ open: true, status: 'error', message: error.message });
        }
      }, 450);
    };
    reader.readAsText(file);
    e.target.value = null;
  }

  // --- Esc closes every overlay (mirrors the mockup) ---
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setQuickAdd((q) => ({ ...q, open: false }));
        setManageOpen(false);
        setVehicleEditor((ve) => ({ ...ve, open: false }));
        setCsv((c) => ({ ...c, open: false }));
        setLogDelete((ld) => ({ ...ld, open: false }));
        setVehiclePickerOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // --- Body scroll lock while any overlay is open ---
  useEffect(() => {
    const anyOpen = quickAdd.open || vehiclePickerOpen || manageOpen || vehicleEditor.open || csv.open || logDelete.open;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
  }, [quickAdd.open, vehiclePickerOpen, manageOpen, vehicleEditor.open, csv.open, logDelete.open]);

  // --- MPG chart tooltip (mirrors the mockup's pointer logic) ---
  const [tip, setTip] = useState({ visible: false, active: -1, text: '' });

  function showPoint(i) {
    const d = chart.dots[i];
    setTip({ visible: true, active: i, text: formatDate(d.date) + ' · ' + d.mpg + ' MPG' });
  }

  function hideTip() {
    setTip((t) => ({ ...t, visible: false, active: -1 }));
  }

  function showNearest(clientX) {
    if (!chart || !chart.dots.length) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    // Map the pointer to SVG coordinates, then snap to the nearest fill-up by x.
    const svgX = ((clientX - rect.left) / rect.width) * chart.width;
    let nearest = 0;
    let best = Infinity;
    chart.dots.forEach((d, i) => {
      const dist = Math.abs(Number(d.cx) - svgX);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    showPoint(nearest);
  }

  useEffect(() => {
    const tooltip = tooltipRef.current;
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    const crosshair = crosshairRef.current;
    if (!tooltip || !svg || !wrap) return;
    if (!tip.visible || tip.active < 0 || !chart) {
      tooltip.style.display = 'none';
      if (crosshair) crosshair.hidden = true;
      return;
    }
    const dot = chart.dots[tip.active];
    if (crosshair) {
      crosshair.hidden = false;
      crosshair.setAttribute('x1', dot.cx);
      crosshair.setAttribute('x2', dot.cx);
    }
    tooltip.textContent = tip.text;
    tooltip.style.display = 'block';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    const svgBox = svg.getBoundingClientRect();
    const wrapBox = wrap.getBoundingClientRect();
    const pointX = svgBox.left - wrapBox.left + (Number(dot.cx) / 720) * svgBox.width;
    const pointY = svgBox.top - wrapBox.top + (Number(dot.cy) / 300) * svgBox.height;
    const tipWidth = tooltip.offsetWidth;
    const tipHeight = tooltip.offsetHeight;
    tooltip.style.left = Math.max(0, Math.min(wrapBox.width - tipWidth, pointX - tipWidth / 2)) + 'px';
    tooltip.style.top = Math.max(0, pointY - tipHeight - 12) + 'px';
  }, [tip, chart]);

  // --- Cell rendering (mirrors the mockup's cellFor) ---
  function cellFor(entry, key) {
    if (key === 'date') return formatDate(entry.date);
    if (key === 'kind') return entry.kind === 'fuel' ? 'Fuel' : entry.kind === 'service' ? 'Maintenance' : 'Mod';
    if (key === 'odometer') return formatNumber(entry.odo) + ' mi';
    if (key === 'mileage') return formatNumber(entry.mileage != null ? entry.mileage : entry.odo) + ' mi';
    if (key === 'gallons') return Number(entry.volume).toFixed(3);
    if (key === 'cost') return formatMoney((Number(entry.volume) || 0) * (Number(entry.unitPrice) || 0));
    if (key === 'mpg') {
      return entry.mpg == null ? (
        'N/A'
      ) : (
        <>
          <span className="table-primary">{Number(entry.mpg).toFixed(2)}</span>
          <span className="table-secondary">+{Number(entry.distance || 0).toFixed(1)} mi</span>
        </>
      );
    }
    if (key === 'service') return entry.service;
    if (key === 'performedBy') return entry.performedBy || '—';
    if (key === 'part') return entry.part;
    if (key === 'specs') return entry.specs;
    if (key === 'notes') return entry.notes || '—';
    if (key === 'summary') {
      if (entry.kind === 'fuel') return 'Fill-up' + (entry.notes ? ' · ' + entry.notes : '');
      if (entry.kind === 'service') return entry.service + (entry.performedBy ? ' · ' + entry.performedBy : '');
      return entry.part + ' · ' + entry.specs;
    }
    return '—';
  }

  function entryActionButtons(entry) {
    const date = formatDate(entry.date);
    return (
      <div className="table-actions">
        <button className="row-action" type="button" onClick={() => prefillEdit(entry.id)} aria-label={'Edit ' + date + ' entry'} title="Edit">
          <Icon aria-hidden="true">{ICONS.edit}</Icon>
        </button>
        <button className="row-action delete" type="button" onClick={() => openLogDelete([entry.id])} aria-label={'Delete ' + date + ' entry'} title="Delete">
          <Icon aria-hidden="true">{ICONS.trash}</Icon>
        </button>
      </div>
    );
  }

  function fuelTotalPreview() {
    const gallons = parseFloat(fuelDraft.gallons);
    const price = parseFloat(fuelDraft.price);
    return Number.isFinite(gallons) && Number.isFinite(price) ? gallons * price : null;
  }

  const quickAddTitle =
    quickAdd.form == null
      ? 'Choose entry type'
      : quickAdd.form === 'fuel'
        ? quickAdd.editing
          ? 'Edit Fill-up'
          : 'Add Fill-up'
        : quickAdd.form === 'service'
          ? quickAdd.editing
            ? 'Edit Maintenance / Repair Log'
            : 'Add Maintenance / Repair Log'
          : quickAdd.editing
            ? 'Edit Mod'
            : 'Add Mod';

  const pageSizeOptions = [10, 25, 50, 'all'];

  if (dbLoading) {
    return (
      <div className="boot-screen">
        <span className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-gate">
        <div className="auth-card">
          <h1>
            Virtual <em>Garage</em>
          </h1>
          <p>Track vehicle specs, mods, maintenance logs, and fuel efficiency — all in one enthusiast hub.</p>
          <button className="auth-google" type="button" onClick={handleGoogleSignIn}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="app-shell">
      <aside className="rail" aria-label="Primary navigation">
        <nav className="nav-stack">
          <button className="nav-button nav-add" type="button" onClick={() => openQuickAdd(null, false)} aria-label="Add new entry">
            <Icon>{ICONS.plus}</Icon>
            <span>Add new entry</span>
          </button>
          <button className={'nav-button' + (activeScreen === 'garage' ? ' active' : '')} type="button" onClick={() => setScreen('garage')} aria-label="My Garage">
            <Icon>{ICONS.car}</Icon>
            <span>My Garage</span>
          </button>
          <button className={'nav-button' + (activeScreen === 'logbook' ? ' active' : '')} type="button" onClick={() => applyLogFilter('all')} aria-label="Logbook">
            <Icon>{ICONS.book}</Icon>
            <span>Logbook</span>
          </button>
        </nav>
        <div className="rail-spacer"></div>
        <div className="profile">
          <button className="profile-button" type="button" onClick={handleSignOut} aria-label="Sign out">
            <span className="profile-avatar">{(user.email || 'V').charAt(0).toUpperCase()}</span>
            <div>
              <strong>{user.email}</strong>
              <small>Sign out</small>
            </div>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="app-header" aria-label="Vehicle controls">
          <button className="vehicle-selector" id="vehicle-selector" type="button" aria-haspopup="dialog" aria-controls="vehicle-picker" onClick={() => setVehiclePickerOpen(true)}>
            <span className="selector-mark">
              <Icon>
                <path d="M4 16l1.8-5.2A2 2 0 0 1 7.7 9h8.6a2 2 0 0 1 1.9 1.8L20 16" />
                <path d="M5 16h14v3H5z" />
              </Icon>
            </span>
            <span className="selector-copy">
              <small>Your Vehicle</small>
              <strong className="active-vehicle-name">{activeVehicleName}</strong>
            </span>
            <Icon className="icon icon-sm selector-chevron" aria-hidden="true">
              {ICONS.swap}
            </Icon>
          </button>
        </header>

        <section className={'screen' + (activeScreen === 'garage' ? ' active' : '')} id="garage" aria-labelledby="garage-title">
          <header className="topline">
            <div>
              <p className="eyebrow">Garage overview</p>
              <h1 className="screen-title" id="garage-title">Your machine, at a glance.</h1>
            </div>
          </header>

          <section className={'panel garage-empty' + (!activeVehicle ? ' visible' : '')} id="garage-empty">
            <div className="empty-state">
              <p>No vehicles in garage yet.</p>
              <button type="button" onClick={() => openVehicleEditor('add')}>+ Add your first vehicle</button>
            </div>
          </section>

          {activeVehicle && (
            <>
              <article className="vehicle-hero">
                <div className="hero-copy">
                  <div className="vehicle-kicker">
                    Your Vehicle · <span id="hero-code">{activeVehicle.nickname || 'NO NICKNAME'}</span>
                  </div>
                  <h2 className="vehicle-title" id="hero-name">
                    {activeVehicle.year} {activeVehicle.make}
                    <br />
                    <span className="no-break">{activeVehicle.model}</span>
                  </h2>
                  <p className="vehicle-subtitle" id="hero-subtitle">
                    {[activeVehicle.color, activeVehicle.trim].filter(Boolean).join(' · ') || 'Vehicle profile'}
                  </p>
                  <div className="hero-odometer">
                    <strong id="hero-odometer">{latestOdoText}</strong>
                    <span>Odometer · miles</span>
                  </div>
                </div>
                <div className="hero-car" aria-hidden="true">
                  <span className="hero-car-frame">
                    <img className="hero-car-image" src={heroCarImage} alt="" />
                  </span>
                </div>
                <div className="hero-actions">
                  <button
                    className="icon-button hero-menu-button"
                    id="vehicle-manage-button"
                    ref={manageButtonRef}
                    type="button"
                    aria-label="Manage your vehicle"
                    aria-haspopup="menu"
                    aria-controls="vehicle-manage-menu"
                    aria-expanded={manageOpen}
                    onClick={() => (manageOpen ? closeVehicleManage() : openVehicleManage())}
                  >
                    <Icon>{ICONS.dots}</Icon>
                  </button>
                </div>
              </article>

              <div className="dashboard-grid">
                <section className="panel" aria-labelledby="stats-title">
                  <div className="panel-head">
                    <div>
                      <h2 className="panel-title" id="stats-title">Fuel stats</h2>
                      <span className="panel-sub">Derived from fill-up history</span>
                    </div>
                    <button className="text-button" type="button" onClick={() => applyLogFilter('fuel')}>
                      View MPG insights
                    </button>
                  </div>
                  <div className="stats-grid">
                    <div className="stat">
                      <div className="stat-label">Lifetime MPG</div>
                      <div className="stat-value" id="stat-lifetime-mpg">
                        {fuelStats.hasRows ? (
                          <>
                            {fuelStats.avg.toFixed(2)} <small>MPG</small>
                          </>
                        ) : (
                          'N/A'
                        )}
                      </div>
                      <div className="stat-trend">Across logged fill-ups</div>
                    </div>
                    <div className="stat">
                      <div className="stat-label">Best MPG</div>
                      <div className="stat-value" id="stat-best-mpg">
                        {fuelStats.hasRows ? (
                          <>
                            {fuelStats.best.toFixed(2)} <small>MPG</small>
                          </>
                        ) : (
                          'N/A'
                        )}
                      </div>
                      <div className="stat-trend">Personal best</div>
                    </div>
                    <div className="stat">
                      <div className="stat-label">Total Spent on Gas</div>
                      <div className="stat-value" id="stat-total-gas">
                        {formatMoney(fuelStats.total)}
                      </div>
                      <div className="stat-trend">Lifetime fuel cost</div>
                    </div>
                  </div>
                </section>
              </div>

              <section className="panel spec-sheet" aria-labelledby="spec-sheet-title">
                <div className="spec-header">
                  <span className="spec-label">Vehicle</span>
                  <div className="spec-vehicle" id="spec-sheet-title">
                    <span id="spec-vehicle-name">{activeVehicleName}</span>{' '}
                    {activeVehicle.nickname ? <em className="spec-nickname" id="spec-nickname">“{activeVehicle.nickname}”</em> : null}
                  </div>
                </div>
                <dl className="spec-grid">
                  <div className="spec-item">
                    <dt>Trim</dt>
                    <dd id="spec-trim">{activeVehicle.trim || '—'}</dd>
                  </div>
                  <div className="spec-item">
                    <dt>Color</dt>
                    <dd id="spec-color">{activeVehicle.color || '—'}</dd>
                  </div>
                  <div className="spec-item">
                    <dt>VIN</dt>
                    <dd className="vin-value" id="spec-vin">
                      {activeVehicle.vin ? String(activeVehicle.vin).toUpperCase() : '—'}
                    </dd>
                  </div>
                  <div className="spec-item">
                    <dt>Purchase Date</dt>
                    <dd id="spec-purchase-date">{activeVehicle.purchaseDate ? formatDate(activeVehicle.purchaseDate) : '—'}</dd>
                  </div>
                  <div className="spec-item">
                    <dt>Purchase Mileage</dt>
                    <dd id="spec-purchase-mileage">
                      {activeVehicle.purchaseMileage !== '' && activeVehicle.purchaseMileage != null ? formatNumber(activeVehicle.purchaseMileage) + ' mi' : '—'}
                    </dd>
                  </div>
                  <div className="spec-item">
                    <dt>Purchase Price</dt>
                    <dd className="price-value" id="spec-purchase-price">
                      {activeVehicle.purchasePrice !== '' && activeVehicle.purchasePrice != null ? formatMoney(activeVehicle.purchasePrice) : '—'}
                    </dd>
                  </div>
                  {activeVehicle.note ? (
                    <div className="spec-item spec-notes" id="spec-notes-row">
                      <dt>Notes</dt>
                      <dd id="spec-notes">{activeVehicle.note}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section className="panel log-panel" aria-labelledby="recent-title">
                <div className="panel-head">
                  <div>
                    <h2 className="panel-title" id="recent-title">Recent logbook</h2>
                    <span className="panel-sub">Fuel, service and upgrades in one timeline</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button className="text-button" type="button" onClick={() => openQuickAdd(null, false)}>
                      Add entry
                    </button>
                    <button className="text-button" type="button" onClick={() => applyLogFilter('all')}>
                      See all activity
                    </button>
                  </div>
                </div>
                <div id="recent-activity" aria-live="polite">
                  {recentEntries.length === 0 ? (
                    <div className="empty-state">
                      <p>No logbook entries yet for this vehicle.</p>
                    </div>
                  ) : (
                    recentEntries.map((entry) => {
                      let title;
                      let meta;
                      let valueMain;
                      let detail;
                      if (entry.kind === 'fuel') {
                        title = 'Fill-up · ' + Number(entry.volume).toFixed(3) + ' gal';
                        meta = [formatShortDate(entry.date), formatNumber(entry.odo) + ' mi', entry.notes].filter(Boolean).join(' · ');
                        valueMain = formatMoney((Number(entry.volume) || 0) * (Number(entry.unitPrice) || 0));
                        detail = entry.mpg == null ? 'MPG unavailable' : Number(entry.mpg).toFixed(2) + ' MPG';
                      } else if (entry.kind === 'service') {
                        title = entry.service || 'Maintenance';
                        meta = [formatShortDate(entry.date), entry.performedBy, entry.notes].filter(Boolean).join(' · ');
                        valueMain = formatNumber(entry.mileage) + ' mi';
                        detail = 'Maintenance';
                      } else {
                        title = entry.part || 'Modification';
                        meta = [formatShortDate(entry.date), entry.specs, entry.notes].filter(Boolean).join(' · ');
                        valueMain = formatNumber(entry.mileage) + ' mi';
                        detail = 'Mod';
                      }
                      return (
                        <div className="activity-row" key={entry.id}>
                          <div className={'activity-icon ' + entry.kind}>
                            <Icon aria-hidden="true">{KIND_ICONS[entry.kind]}</Icon>
                          </div>
                          <div className="activity-copy">
                            <strong>{title}</strong>
                            <span>{meta}</span>
                          </div>
                          <div className="activity-value">
                            {valueMain}
                            <small>{detail}</small>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </>
          )}
        </section>

        <section
          className={'screen' + (activeScreen === 'logbook' ? ' active' : '') + (currentFilter !== 'all' ? ' theme-' + currentFilter : '')}
          id="logbook"
          aria-labelledby="logbook-title"
        >
          <header className="topline">
            <div>
              <p className="eyebrow">Unified history</p>
              <h1 className="screen-title" id="logbook-title">Logbook</h1>
            </div>
          </header>
          <div className="toolbar">
            <div className="filter-group" role="group" aria-label="Filter logbook">
              {[
                ['all', 'All'],
                ['fuel', 'Fuel'],
                ['service', 'Maintenance'],
                ['mods', 'Mods'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={'filter-button' + (currentFilter === key ? ' active' : '')}
                  type="button"
                  onClick={() => applyLogFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="primary-button" type="button" onClick={() => openQuickAdd(null, false)}>
              <Icon className="icon icon-sm">{ICONS.plus}</Icon>
              Add entry
            </button>
          </div>
          <div className="log-controls" id="log-controls" hidden={selectedIds.size === 0}>
            <div className="bulk-actions">
              <button
                className="danger-button bulk-delete-button"
                id="bulk-delete"
                type="button"
                aria-label={'Delete ' + selectedIds.size + ' selected ' + (selectedIds.size === 1 ? 'entry' : 'entries')}
                onClick={() => openLogDelete(Array.from(selectedIds))}
              >
                <Icon aria-hidden="true">{ICONS.trash}</Icon>
                <span className="bulk-delete-count" id="bulk-delete-count">
                  {selectedIds.size}
                </span>
              </button>
            </div>
          </div>
          <div className="panel log-table-wrap" id="log-table-wrap">
            <table className="data-table" id="log-table">
              <thead>
                <tr>
                  <th>
                    <input ref={selectAllRef} className="row-check" id="select-all" type="checkbox" aria-label="Select all rows on this page" onChange={(e) => toggleSelectPage(e.target.checked)} />
                  </th>
                  {columnsFor(currentFilter).map((col) =>
                    currentFilter === 'all' ? (
                      <th key={col.key}>{col.label}</th>
                    ) : (
                      <th key={col.key}>
                        <button className="sort-button" type="button" onClick={() => handleSort(col.key)}>
                          {col.label}{' '}
                          <span className="sort-indicator">{sortState.key === col.key ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                    )
                  )}
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.length === 0 ? (
                  <tr>
                    <td colSpan={columnsFor(currentFilter).length + 2}>
                      <div className="empty-state">
                        <p>{emptyStateText(currentFilter)}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <input
                          className="row-check"
                          type="checkbox"
                          aria-label={'Select ' + formatDate(entry.date) + ' entry'}
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                        />
                      </td>
                      {columnsFor(currentFilter).map((col) => (
                        <td key={col.key}>{cellFor(entry, col.key)}</td>
                      ))}
                      <td>{entryActionButtons(entry)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="pagination" id="pagination">
              <label className="page-size">
                Show{' '}
                <select className="page-size-select" value={String(pageSize)} onChange={(e) => handlePageSizeChange(e.target.value)}>
                  {pageSizeOptions.map((size) => (
                    <option key={String(size)} value={String(size)}>
                      {size === 'all' ? 'All' : size}
                    </option>
                  ))}
                </select>
              </label>
              <span className="page-info">
                Page {safePage} of {totalPages}
              </span>
              <div className="page-buttons">
                <button className="page-button" type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                  ‹
                </button>
                <button className="page-button" type="button" aria-label="Next page" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  ›
                </button>
              </div>
            </div>
          </div>
          <div className="mobile-log-tools" id="mobile-log-tools">
            <label className="mobile-select-label">
              <input ref={mobileSelectAllRef} className="row-check" id="mobile-select-all" type="checkbox" aria-label="Select all entries on this page" onChange={(e) => toggleSelectPage(e.target.checked)} />
              <span>Select page</span>
            </label>
            <label className="page-size mobile-page-size">
              Show{' '}
              <select className="page-size-select" value={String(pageSize)} onChange={(e) => handlePageSizeChange(e.target.value)}>
                {pageSizeOptions.map((size) => (
                  <option key={String(size)} value={String(size)}>
                    {size === 'all' ? 'All' : size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mobile-log-cards" id="mobile-log-cards">
            {visibleEntries.length === 0 ? (
              <div className="empty-state">
                <p>{emptyStateText(currentFilter)}</p>
              </div>
            ) : (
              visibleEntries.map((entry) =>
                entry.kind === 'fuel' ? (
                  <article className="mobile-log-card mobile-fuel-card" key={entry.id}>
                    <div className="mobile-fuel-head">
                      <div className="mobile-fuel-date">
                        <span>Date</span>
                        <strong>{formatDate(entry.date)}</strong>
                      </div>
                      <div className="mobile-fuel-odo">
                        <span>Odometer</span>
                        <strong>{formatNumber(entry.odo)} mi</strong>
                      </div>
                    </div>
                    <div className="mobile-fuel-stats">
                      <div className="mobile-fuel-stat">
                        <span>Gallons</span>
                        <strong>{Number(entry.volume).toFixed(3)}</strong>
                      </div>
                      <div className="mobile-fuel-stat">
                        <span>Price / Gal</span>
                        <strong>{formatMoney(entry.unitPrice)}</strong>
                      </div>
                      <div className="mobile-fuel-stat">
                        <span>Total Cost</span>
                        <strong>{formatMoney((Number(entry.volume) || 0) * (Number(entry.unitPrice) || 0))}</strong>
                      </div>
                      <div className="mobile-fuel-stat">
                        <span>MPG</span>
                        <strong>{entry.mpg == null ? 'N/A' : Number(entry.mpg).toFixed(2)}</strong>
                        {entry.mpg == null || entry.distance == null ? null : <span className="mobile-fuel-distance">+{Number(entry.distance).toFixed(1)} mi</span>}
                      </div>
                    </div>
                    {entry.notes ? <p className="mobile-fuel-notes">{entry.notes}</p> : null}
                    <div className="mobile-fuel-actions">
                      <label className="mobile-select-label">
                        <input
                          className="row-check"
                          type="checkbox"
                          aria-label={'Select ' + formatDate(entry.date) + ' entry'}
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                        />
                        <span>Select</span>
                      </label>
                      {entryActionButtons(entry)}
                    </div>
                  </article>
                ) : (
                  <article className="mobile-log-card mobile-fuel-card mobile-entry-card" key={entry.id}>
                    <div className="mobile-fuel-head">
                      <div className="mobile-fuel-date">
                        <span>Date</span>
                        <strong>{formatDate(entry.date)}</strong>
                      </div>
                      <div className="mobile-fuel-odo">
                        <span>Mileage</span>
                        <strong>{formatNumber(entry.mileage)} mi</strong>
                      </div>
                    </div>
                    <div className="mobile-entry-grid">
                      <div className="mobile-entry-stat">
                        <span>{entry.kind === 'service' ? 'Service' : 'Mod Type / Part'}</span>
                        <strong>{entry.kind === 'service' ? entry.service : entry.part}</strong>
                      </div>
                      <div className="mobile-entry-stat">
                        <span>{entry.kind === 'service' ? 'Performed By' : 'Brand / Model / Specs'}</span>
                        <strong>{entry.kind === 'service' ? entry.performedBy || '—' : entry.specs}</strong>
                      </div>
                    </div>
                    {entry.notes ? <p className="mobile-fuel-notes">{entry.notes}</p> : null}
                    <div className="mobile-fuel-actions">
                      <label className="mobile-select-label">
                        <input
                          className="row-check"
                          type="checkbox"
                          aria-label={'Select ' + formatDate(entry.date) + ' entry'}
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                        />
                        <span>Select</span>
                      </label>
                      {entryActionButtons(entry)}
                    </div>
                  </article>
                )
              )
            )}
          </div>
          <div className="mobile-pagination" id="mobile-pagination">
            <span className="page-info">
              Page {safePage} of {totalPages}
            </span>
            <div className="page-buttons">
              <button className="page-button" type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                ‹
              </button>
              <button className="page-button" type="button" aria-label="Next page" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                ›
              </button>
            </div>
          </div>
          <section className={'fuel-insights' + (currentFilter === 'fuel' ? ' visible' : '')} id="fuel-insights" aria-labelledby="fuel-insights-title" hidden={currentFilter !== 'fuel'}>
            <div className="fuel-insights-head">
              <div>
                <h2 id="fuel-insights-title">Fuel insights</h2>
                <p>MPG performance and fuel spend</p>
              </div>
            </div>
            <div className="insights-grid">
              <section className="panel chart-card" id="mpg-chart-card" aria-labelledby="efficiency-title" hidden={!chart}>
                <div className="panel-head" style={{ padding: 0 }}>
                  <div>
                    <h2 className="panel-title" id="efficiency-title">
                      Average MPG Over Time
                    </h2>
                    <span className="panel-sub">Fill-up dates · MPG</span>
                  </div>
                  <span className="chip">Avg {chartAvg}</span>
                </div>
                <div className="chart-wrap" ref={wrapRef}>
                  {chart && (
                    <svg
                      id="mpg-chart"
                      ref={svgRef}
                      viewBox="0 0 720 300"
                      role="img"
                      aria-label="Average MPG over time"
                      onPointerDown={(e) => showNearest(e.clientX)}
                      onPointerMove={(e) => showNearest(e.clientX)}
                      onPointerLeave={(e) => {
                        if (e.pointerType !== 'touch') hideTip();
                      }}
                      onTouchStart={(e) => {
                        if (e.touches[0]) showNearest(e.touches[0].clientX);
                      }}
                      onTouchMove={(e) => {
                        if (e.touches[0]) showNearest(e.touches[0].clientX);
                      }}
                    >
                      <defs>
                        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--fuel)" stopOpacity=".34" />
                          <stop offset="100%" stopColor="var(--fuel)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {chart.grid.map((g, i) => (
                        <g key={i}>
                          <line className="chart-gridline" x1={chart.left} y1={g.y} x2={chart.right} y2={g.y} />
                          <text className="axis-label" x="8" y={g.y + 4}>
                            {g.label}
                          </text>
                        </g>
                      ))}
                      <path className="chart-area" d={chart.area} />
                      <path className="chart-line" d={chart.line} />
                      <line className="chart-crosshair" id="chart-crosshair" ref={crosshairRef} y1={chart.top} y2={chart.bottom} hidden />
                      <text className="axis-label" x={chart.left} y="278">
                        {chart.first}
                      </text>
                      <text className="axis-label" textAnchor="end" x={chart.right} y="278">
                        {chart.last}
                      </text>
                    </svg>
                  )}
                  <div className="chart-tooltip" id="chart-tooltip" ref={tooltipRef} role="tooltip"></div>
                </div>
              </section>
              <div className="metrics-stack">
                <section className="panel metric-card">
                  <span className="panel-sub">Best fill-up</span>
                  <div className="metric-number" id="metric-best">
                    {fuelStats.hasRows ? (
                      <>
                        {fuelStats.best.toFixed(2)} <small style={{ font: "600 13px 'IBM Plex Sans'" }}>MPG</small>
                      </>
                    ) : (
                      'N/A'
                    )}
                  </div>
                  <div className="metric-caption" id="metric-best-date">
                    {fuelStats.bestDate}
                  </div>
                </section>
                <section className="panel metric-card">
                  <span className="panel-sub">Total fuel spend</span>
                  <div className="metric-number" id="metric-spend">
                    {formatMoney(fuelStats.total)}
                  </div>
                  <div className="metric-caption">Across all logged fill-ups</div>
                </section>
              </div>
            </div>
          </section>
        </section>

        <section className={'screen' + (activeScreen === 'service' ? ' active' : '')} id="service" aria-labelledby="service-title">
          <header className="topline">
            <div>
              <p className="eyebrow">Maintenance planning</p>
              <h1 className="screen-title" id="service-title">
                Service
              </h1>
            </div>
          </header>
          <div className="service-layout">
            <section className="panel" aria-labelledby="schedule-title">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title" id="schedule-title">
                    Upcoming schedule
                  </h2>
                  <span className="panel-sub">Sorted by mileage remaining</span>
                </div>
                <button className="text-button" type="button" onClick={() => openQuickAdd('service', false)}>
                  Add service
                </button>
              </div>
              <div className="service-timeline">
                <div className="timeline-item">
                  <div className="timeline-marker warn"></div>
                  <div className="timeline-copy">
                    <strong>Engine oil &amp; filter</strong>
                    <span>Target 30,000 mi · every 5,000 mi</span>
                  </div>
                  <div className="timeline-due">
                    1,538 mi<small>Next</small>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-marker"></div>
                  <div className="timeline-copy">
                    <strong>Brake fluid inspection</strong>
                    <span>Target 32,500 mi · inspect condition</span>
                  </div>
                  <div className="timeline-due">
                    4,038 mi<small>Upcoming</small>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-marker"></div>
                  <div className="timeline-copy">
                    <strong>Transmission fluid</strong>
                    <span>Target 40,000 mi · manual transmission</span>
                  </div>
                  <div className="timeline-due">
                    11,538 mi<small>Planned</small>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <button className={'mobile-nav-button' + (activeScreen === 'garage' ? ' active' : '')} type="button" onClick={() => setScreen('garage')}>
          <Icon>{ICONS.carPlain}</Icon>
          <span>My Garage</span>
        </button>
        <span className="mobile-add-slot">
          <button className="mobile-add-button" type="button" aria-label="Add new entry" onClick={() => openQuickAdd(null, false)}>
            <Icon>{ICONS.plus}</Icon>
            <span>Add entry</span>
          </button>
        </span>
        <button className={'mobile-nav-button' + (activeScreen === 'logbook' ? ' active' : '')} type="button" onClick={() => applyLogFilter('all')}>
          <Icon>{ICONS.book}</Icon>
          <span>Logbook</span>
        </button>
      </nav>
    </div>

      <div className={'overlay' + (quickAdd.open ? ' open' : '')} id="quick-add" aria-hidden={!quickAdd.open} onClick={(e) => { if (e.target === e.currentTarget) closeQuickAdd(); }}>
        <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
          <div className="sheet-head">
            <div>
              <p className="eyebrow">Quick entry</p>
              <h2 className="sheet-title" id="quick-add-title">{quickAddTitle}</h2>
            </div>
            <button className="icon-button" id="close-sheet" type="button" aria-label="Close" onClick={closeQuickAdd}>
              <Icon>{ICONS.close}</Icon>
            </button>
          </div>
          <div className="entry-chooser" id="entry-chooser" hidden={quickAdd.form !== null}>
            <button className="entry-choice" type="button" data-form="fuel" onClick={() => setQuickAdd((q) => ({ ...q, form: 'fuel' }))}>
              <Icon>{ICONS.fuel}</Icon>Fill-up
            </button>
            <button className="entry-choice" type="button" data-form="service" onClick={() => setQuickAdd((q) => ({ ...q, form: 'service' }))}>
              <Icon>{ICONS.wrench}</Icon>Maintenance
            </button>
            <button className="entry-choice" type="button" data-form="mod" onClick={() => setQuickAdd((q) => ({ ...q, form: 'mod' }))}>
              <Icon>{ICONS.bolt}</Icon>Mod
            </button>
          </div>
          <div className="entry-editor" id="entry-editor" hidden={quickAdd.form === null} data-entry={quickAdd.form || undefined}>
            <button className="entry-back" id="entry-back" type="button" onClick={backToChooser}>
              ← Entry type
            </button>
            <div className="sheet-tabs" role="tablist">
              {[
                ['fuel', 'Fill-up'],
                ['service', 'Maintenance'],
                ['mod', 'Mod'],
              ].map(([key, label]) => (
                <button key={key} className={'sheet-tab' + (quickAdd.form === key ? ' active' : '')} data-form={key} type="button" role="tab" onClick={() => setQuickAdd((q) => ({ ...q, form: key }))}>
                  {label}
                </button>
              ))}
            </div>
            <form id="quick-form" onSubmit={handleQuickSubmit}>
              <div className={'form-panel' + (quickAdd.form === 'fuel' ? ' active' : '')} data-panel="fuel">
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="fuel-date">Date *</label>
                    <input id="fuel-date" type="date" required disabled={quickAdd.form !== 'fuel'} value={fuelDraft.date} onChange={(e) => setFuelDraft({ ...fuelDraft, date: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="fuel-odo">Odometer *</label>
                    <input id="fuel-odo" type="number" inputMode="decimal" step="0.1" required disabled={quickAdd.form !== 'fuel'} placeholder="e.g. 45000" value={fuelDraft.odo} onChange={(e) => setFuelDraft({ ...fuelDraft, odo: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="fuel-gallons">Gallons *</label>
                    <input id="fuel-gallons" type="number" inputMode="decimal" step="0.001" required disabled={quickAdd.form !== 'fuel'} placeholder="e.g. 12.5" value={fuelDraft.gallons} onChange={(e) => setFuelDraft({ ...fuelDraft, gallons: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="fuel-price">Price/Gal *</label>
                    <input id="fuel-price" type="number" inputMode="decimal" step="0.01" required disabled={quickAdd.form !== 'fuel'} placeholder="3.50" value={fuelDraft.price} onChange={(e) => setFuelDraft({ ...fuelDraft, price: e.target.value })} />
                  </div>
                  <div className="field full">
                    <label htmlFor="fuel-notes">Notes (Optional)</label>
                    <input id="fuel-notes" type="text" disabled={quickAdd.form !== 'fuel'} placeholder="e.g. Costco, Road Trip..." value={fuelDraft.notes} onChange={(e) => setFuelDraft({ ...fuelDraft, notes: e.target.value })} />
                  </div>
                </div>
                <div className="total-preview" id="fuel-total-row" hidden={fuelTotalPreview() == null}>
                  <span>Total Cost</span>
                  <strong id="fuel-total">{fuelTotalPreview() != null ? formatMoney(fuelTotalPreview()) : ''}</strong>
                </div>
                <div className="form-import-row">
                  <button
                    className="form-import-button"
                    id="import-csv"
                    type="button"
                    onClick={() => {
                      setCsv({ open: true, status: 'ready', message: 'Ready to import' });
                    }}
                  >
                    <Icon className="icon icon-sm">{ICONS.download}</Icon>
                    Import fuel logs from CSV
                  </button>
                </div>
              </div>
              <div className={'form-panel' + (quickAdd.form === 'service' ? ' active' : '')} data-panel="service">
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="service-date">Service Date *</label>
                    <input id="service-date" type="date" required disabled={quickAdd.form !== 'service'} value={serviceDraft.date} onChange={(e) => setServiceDraft({ ...serviceDraft, date: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="service-odo">Mileage *</label>
                    <input id="service-odo" type="number" required disabled={quickAdd.form !== 'service'} placeholder="e.g. 45000" value={serviceDraft.odo} onChange={(e) => setServiceDraft({ ...serviceDraft, odo: e.target.value })} />
                  </div>
                  <div className="field full">
                    <label htmlFor="service-name">Service *</label>
                    <input id="service-name" type="text" required disabled={quickAdd.form !== 'service'} placeholder="e.g. Oil change & filter, Front brake pads, Spark plugs" value={serviceDraft.name} onChange={(e) => setServiceDraft({ ...serviceDraft, name: e.target.value })} />
                  </div>
                  <div className="field full">
                    <label htmlFor="service-by">Performed By (Car shop or DIY)</label>
                    <input id="service-by" type="text" disabled={quickAdd.form !== 'service'} placeholder="e.g. DIY, Dealership, Speed Shop, Precision Auto" value={serviceDraft.by} onChange={(e) => setServiceDraft({ ...serviceDraft, by: e.target.value })} />
                  </div>
                  <div className="field full">
                    <label htmlFor="service-notes">Notes (Optional)</label>
                    <textarea id="service-notes" rows="3" disabled={quickAdd.form !== 'service'} placeholder="Part numbers, fluid types/weight, torque specs, cost, warranty..." value={serviceDraft.notes} onChange={(e) => setServiceDraft({ ...serviceDraft, notes: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className={'form-panel' + (quickAdd.form === 'mod' ? ' active' : '')} data-panel="mod">
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="mod-date">Date</label>
                    <input id="mod-date" type="date" disabled={quickAdd.form !== 'mod'} value={modDraft.date} onChange={(e) => setModDraft({ ...modDraft, date: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="mod-odo">Mileage</label>
                    <input id="mod-odo" type="number" disabled={quickAdd.form !== 'mod'} placeholder="e.g. 45000" value={modDraft.odo} onChange={(e) => setModDraft({ ...modDraft, odo: e.target.value })} />
                  </div>
                  <div className="field full">
                    <label htmlFor="mod-name">Mod Type / Part *</label>
                    <input id="mod-name" type="text" required disabled={quickAdd.form !== 'mod'} placeholder="e.g. Exhaust, Wheels, Suspension, Tune" value={modDraft.name} onChange={(e) => setModDraft({ ...modDraft, name: e.target.value })} />
                  </div>
                  <div className="field full">
                    <label htmlFor="mod-specs">Brand / Model / Specs *</label>
                    <input id="mod-specs" type="text" required disabled={quickAdd.form !== 'mod'} placeholder="e.g. Borla S-Type Cat-Back, Enkei RPF1 18x9.5 +38" value={modDraft.specs} onChange={(e) => setModDraft({ ...modDraft, specs: e.target.value })} />
                  </div>
                  <div className="field full">
                    <label htmlFor="mod-notes">Notes (Optional)</label>
                    <textarea id="mod-notes" rows="2" disabled={quickAdd.form !== 'mod'} placeholder="e.g. Installed at 45k miles, cost $800, bought from Vivid Racing..." value={modDraft.notes} onChange={(e) => setModDraft({ ...modDraft, notes: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="sheet-footer">
                <button className="secondary-button cancel-button" id="cancel-entry" type="button" hidden={!(quickAdd.form === 'fuel' && quickAdd.editing)} onClick={closeQuickAdd}>
                  Cancel
                </button>
                <button className="primary-button" id="save-entry" type="submit">
                  Save
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      <div className={'overlay' + (vehiclePickerOpen ? ' open' : '')} id="vehicle-picker" aria-hidden={!vehiclePickerOpen} onClick={(e) => { if (e.target === e.currentTarget) setVehiclePickerOpen(false); }}>
        <section className="sheet vehicle-sheet" role="dialog" aria-modal="true" aria-labelledby="vehicle-picker-title">
          <div className="sheet-head">
            <div>
              <p className="eyebrow">Garage</p>
              <h2 className="sheet-title" id="vehicle-picker-title">
                Switch vehicle
              </h2>
            </div>
            <button className="icon-button" id="close-vehicle-picker" type="button" aria-label="Close" onClick={() => setVehiclePickerOpen(false)}>
              <Icon>{ICONS.close}</Icon>
            </button>
          </div>
          <div className="vehicle-options">
            {vehicles.map((v) => {
              const fuels = logs.filter((l) => l.vehicleId === v.id && l.odo);
              const latest = fuels.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
              return (
                <button
                  key={v.id}
                  className={'vehicle-option' + (activeVehicle && activeVehicle.id === v.id ? ' active' : '')}
                  type="button"
                  data-vehicle={v.id}
                  onClick={() => setVehicle(v.id, false)}
                >
                  <span className="vehicle-card-mark">
                    <Icon>
                      <path d="M4 16l1.8-5.2A2 2 0 0 1 7.7 9h8.6a2 2 0 0 1 1.9 1.8L20 16" />
                      <path d="M5 16h14v3H5z" />
                    </Icon>
                  </span>
                  <span>
                    <strong>{buildVehicleName(v)}</strong>
                    <small>
                      {(v.nickname || 'No nickname') + ' · ' + (latest ? formatNumber(latest.odo) : '0') + ' miles'}
                    </small>
                  </span>
                </button>
              );
            })}
            <button className="vehicle-option add" id="add-vehicle" type="button" onClick={() => openVehicleEditor('add')}>
              <span className="vehicle-card-mark">
                <Icon>{ICONS.plus}</Icon>
              </span>
              Add vehicle
            </button>
          </div>
          <button className="picker-signout" type="button" onClick={handleSignOut}>
            Sign out ({user.email})
          </button>
        </section>
      </div>

      <div className={'vehicle-manage-layer' + (manageOpen ? ' open' : '')} id="vehicle-manage-layer" aria-hidden={!manageOpen} onClick={(e) => { if (e.target === e.currentTarget) closeVehicleManage(); }}>
        <section className="vehicle-manage-menu" id="vehicle-manage-menu" ref={manageMenuRef} role="menu" aria-labelledby="vehicle-manage-button">
          <div className="manage-mobile-head">
            <strong>Manage vehicle</strong>
            <button className="icon-button" id="close-vehicle-manage" type="button" aria-label="Close vehicle menu" onClick={closeVehicleManage}>
              <Icon>{ICONS.close}</Icon>
            </button>
          </div>
          <div className="manage-actions" id="vehicle-manage-actions" hidden={deleteConfirmVisible}>
            <p className="manage-label">Your Vehicle</p>
            <button className="manage-action" id="edit-vehicle" type="button" role="menuitem" onClick={() => openVehicleEditor('edit')}>
              <Icon>{ICONS.edit}</Icon>
              Edit vehicle details
            </button>
            <button className="manage-action" id="add-new-vehicle" type="button" role="menuitem" onClick={() => openVehicleEditor('add')}>
              <Icon>{ICONS.plus}</Icon>
              Add new vehicle
            </button>
            <div className="manage-divider"></div>
            <button className="manage-action delete" id="delete-vehicle" type="button" role="menuitem" onClick={() => setDeleteConfirmVisible(true)}>
              <Icon>{ICONS.trash}</Icon>
              Delete vehicle
            </button>
          </div>
          <div className="delete-confirm" id="delete-confirm" hidden={!deleteConfirmVisible}>
            <h3>Delete this vehicle?</h3>
            <p>
              <span className="active-vehicle-name">{activeVehicleName}</span> will be removed from your garage.
            </p>
            <div className="delete-confirm-actions">
              <button className="manage-cancel" id="cancel-delete" type="button" onClick={() => setDeleteConfirmVisible(false)}>
                Cancel
              </button>
              <button className="manage-delete-confirm" id="confirm-delete" type="button" onClick={confirmDeleteVehicle}>
                Delete
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className={'overlay' + (vehicleEditor.open ? ' open' : '')} id="vehicle-editor" aria-hidden={!vehicleEditor.open} onClick={(e) => { if (e.target === e.currentTarget) closeVehicleEditor(); }}>
        <section className="sheet vehicle-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="vehicle-editor-title">
          <div className="sheet-head">
            <div>
              <p className="eyebrow">Garage</p>
              <h2 className="sheet-title" id="vehicle-editor-title">
                {vehicleEditor.mode === 'edit' ? 'Edit vehicle details' : 'Add new vehicle'}
              </h2>
            </div>
            <button className="icon-button" id="close-vehicle-editor" type="button" aria-label="Close" onClick={closeVehicleEditor}>
              <Icon>{ICONS.close}</Icon>
            </button>
          </div>
          <div className="vehicle-editor-body">
            <p className="vehicle-form-note" id="vehicle-form-note">
              {vehicleEditor.mode === 'edit' ? 'Update the complete vehicle profile and purchase specifications.' : 'Add vehicle identity and purchase specifications.'}
            </p>
            <form id="vehicle-form" onSubmit={handleVehicleSubmit}>
              <div className="form-grid" style={{ marginTop: 22 }}>
                <h3 className="form-section-title">Vehicle</h3>
                <div className="field">
                  <label htmlFor="vehicle-year">Year *</label>
                  <input id="vehicle-year" type="number" inputMode="numeric" required placeholder="e.g. 2024" value={vehicleDraft.year} onChange={(e) => setVehicleDraft({ ...vehicleDraft, year: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="vehicle-make">Make *</label>
                  <input id="vehicle-make" type="text" required placeholder="e.g. Honda, Ford, Porsche" value={vehicleDraft.make} onChange={(e) => setVehicleDraft({ ...vehicleDraft, make: e.target.value })} />
                </div>
                <div className="field full">
                  <label htmlFor="vehicle-model">Model *</label>
                  <input id="vehicle-model" type="text" required placeholder="e.g. Civic Type R, Mustang GT" value={vehicleDraft.model} onChange={(e) => setVehicleDraft({ ...vehicleDraft, model: e.target.value })} />
                </div>
                <h3 className="form-section-title">Specifications</h3>
                <div className="field full">
                  <label htmlFor="vehicle-nickname">Nickname</label>
                  <input id="vehicle-nickname" type="text" placeholder="e.g. Daily Missile, Track Toy" value={vehicleDraft.nickname} onChange={(e) => setVehicleDraft({ ...vehicleDraft, nickname: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="vehicle-trim">Trim</label>
                  <input id="vehicle-trim" type="text" placeholder="e.g. Type R, GT, Rubicon" value={vehicleDraft.trim} onChange={(e) => setVehicleDraft({ ...vehicleDraft, trim: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="vehicle-color">Color</label>
                  <input id="vehicle-color" type="text" placeholder="e.g. Championship White, Boosted Blue" value={vehicleDraft.color} onChange={(e) => setVehicleDraft({ ...vehicleDraft, color: e.target.value })} />
                </div>
                <div className="field full">
                  <label htmlFor="vehicle-vin">VIN</label>
                  <input className="vin-input" id="vehicle-vin" type="text" maxLength="17" placeholder="17-character VIN" value={vehicleDraft.vin} onChange={(e) => setVehicleDraft({ ...vehicleDraft, vin: e.target.value.toUpperCase() })} />
                </div>
                <div className="field">
                  <label htmlFor="vehicle-purchase-date">Purchase Date</label>
                  <input id="vehicle-purchase-date" type="date" value={vehicleDraft.purchaseDate} onChange={(e) => setVehicleDraft({ ...vehicleDraft, purchaseDate: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="vehicle-purchase-mileage">Mileage When Purchased</label>
                  <input id="vehicle-purchase-mileage" type="number" inputMode="numeric" placeholder="e.g. 15000" value={vehicleDraft.purchaseMileage} onChange={(e) => setVehicleDraft({ ...vehicleDraft, purchaseMileage: e.target.value })} />
                </div>
                <div className="field full">
                  <label htmlFor="vehicle-purchase-price">Purchase Price ($)</label>
                  <input id="vehicle-purchase-price" type="number" inputMode="decimal" step="0.01" placeholder="e.g. 35000" value={vehicleDraft.purchasePrice} onChange={(e) => setVehicleDraft({ ...vehicleDraft, purchasePrice: e.target.value })} />
                </div>
                <div className="field full">
                  <label htmlFor="vehicle-notes">Notes</label>
                  <textarea id="vehicle-notes" rows="2" placeholder="Factory packages, options, history, or nerd notes..." value={vehicleDraft.note} onChange={(e) => setVehicleDraft({ ...vehicleDraft, note: e.target.value })} />
                </div>
              </div>
              <div className="vehicle-form-actions">
                <button className="secondary-button" id="cancel-vehicle-editor" type="button" onClick={closeVehicleEditor}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      <div className={'overlay' + (csv.open ? ' open' : '')} id="csv-import-overlay" aria-hidden={!csv.open} onClick={(e) => { if (e.target === e.currentTarget) setCsv((c) => ({ ...c, open: false })); }}>
        <section className="sheet csv-sheet" role="dialog" aria-modal="true" aria-labelledby="csv-title">
          <div className="sheet-head">
            <div>
              <p className="eyebrow">Logbook</p>
              <h2 className="sheet-title" id="csv-title">
                Import CSV Data
              </h2>
            </div>
            <button className="icon-button" id="close-csv" type="button" aria-label="Close" onClick={() => setCsv((c) => ({ ...c, open: false }))}>
              <Icon>{ICONS.close}</Icon>
            </button>
          </div>
          <p className="csv-copy">Bulk-import fuel logs for your vehicle. Use the template to keep the Date, Odometer, Gallons, PricePerGal, and Notes columns in the expected order.</p>
          <div className="csv-actions">
            <button className="secondary-button" id="download-csv-template" type="button" onClick={downloadCsvTemplate}>
              Download CSV Template
            </button>
            <button className="primary-button" id="select-csv" type="button" onClick={() => document.getElementById('csv-file').click()}>
              Select &amp; Upload CSV
            </button>
            <input id="csv-file" type="file" accept=".csv,text/csv" hidden onChange={handleCsvUpload} />
          </div>
          <div className={'csv-status' + (csv.status === 'success' ? ' success' : '')} id="csv-status">
            {csv.status === 'importing' ? (
              <>
                <span className="spinner"></span>Importing...
              </>
            ) : (
              csv.message
            )}
          </div>
        </section>
      </div>

      <div className={'overlay' + (logDelete.open ? ' open' : '')} id="log-delete-overlay" aria-hidden={!logDelete.open} onClick={(e) => { if (e.target === e.currentTarget) closeLogDelete(); }}>
        <section className="sheet confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="log-delete-title">
          <div className="sheet-head">
            <div>
              <p className="eyebrow">Logbook</p>
              <h2 className="sheet-title" id="log-delete-title">
                {logDelete.ids.length > 1 ? 'Delete selected entries?' : 'Delete entry?'}
              </h2>
            </div>
          </div>
          <p className="confirm-copy" id="log-delete-copy">
            {logDelete.ids.length > 1 ? logDelete.ids.length + ' selected entries will be removed from the logbook.' : 'This entry will be removed from the logbook.'}
          </p>
          <div className="vehicle-form-actions">
            <button className="secondary-button" id="cancel-log-delete" type="button" onClick={closeLogDelete}>
              Cancel
            </button>
            <button className="danger-button" id="confirm-log-delete" type="button" onClick={confirmLogDelete}>
              Delete
            </button>
          </div>
        </section>
      </div>

      <div className={'toast' + (toastVisible ? ' show' : '')} id="toast" role="status" aria-live="polite">
        {toastMsg}
      </div>
    </>
  );
}
