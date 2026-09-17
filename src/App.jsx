import { useState, useMemo, useEffect } from 'react';
import { 
  Car, Fuel, Plus, Trash2, Edit2, Calendar, Hash, 
  DollarSign, Sparkles, Wrench, TrendingUp, Loader2, Upload, 
  Download, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, 
  Check, Save, Gauge, Flame
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- YOUR Firebase Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyC1h9JcKS1rVo5YbaSpdbzcx8SLph-KzCM",
  authDomain: "fuel-mpg-tracker.firebaseapp.com",
  projectId: "fuel-mpg-tracker",
  storageBucket: "fuel-mpg-tracker.firebasestorage.app",
  messagingSenderId: "60966261492",
  appId: "1:60966261492:web:68cb0473a22702097e44a1",
  measurementId: "G-B5E9P6R4XF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

function SortIndicator({ sortKey, column, direction }) {
  if (sortKey !== column) return null;
  return direction === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);

  // Active feature tab with localStorage persistence
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('vg_active_tab') || 'garage';
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('vg_active_tab', tab);
  };

  // State for vehicles, logs, mods, maintenance
  const [vehicles, setVehicles] = useState([]);
  const [activeVehicleId, setActiveVehicleId] = useState('');
  const [logs, setLogs] = useState([]);
  const [mods, setMods] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);

  // UI States - Vehicles
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({ year: '', make: '', model: '' });

  // UI States - Vehicle Details
  const [detailsDrafts, setDetailsDrafts] = useState({});
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsSavedSuccess, setDetailsSavedSuccess] = useState(false);

  // UI States - Fuel Logs
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().split('T')[0],
    odo: '',
    volume: '',
    unitPrice: '',
    notes: ''
  });

  // UI States - Mods
  const [isAddingMod, setIsAddingMod] = useState(false);
  const [newModForm, setNewModForm] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    category: '', 
    specs: '', 
    notes: '' 
  });
  const [editingModId, setEditingModId] = useState(null);
  const [editModForm, setEditModForm] = useState({ 
    date: '', 
    category: '', 
    specs: '', 
    notes: '' 
  });
  const [modSortConfig, setModSortConfig] = useState({ key: 'date', direction: 'desc' });

  // UI States - Maintenance Logs
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);
  const [editingMaintId, setEditingMaintId] = useState(null);
  const [selectedMaintIds, setSelectedMaintIds] = useState([]);
  const [maintSortConfig, setMaintSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [maintForm, setMaintForm] = useState({
    date: new Date().toISOString().split('T')[0],
    item: '',
    mileage: '',
    performer: '',
    notes: ''
  });

  // --- Initialize Authentication ---
  // Listen for login state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Your existing data fetching logic goes here!
      } else {
        setUser(null);
      }
      setDbLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Google Login Function
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  // Sign Out Function
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // --- Fetch Data from Firestore ---
  useEffect(() => {
    if (!user || !db) return;

    const vehiclesRef = collection(db, 'users', user.uid, 'vehicles');
    const unsubVehicles = onSnapshot(vehiclesRef, (snapshot) => {
      const fetchedVehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(fetchedVehicles);
    }, (error) => console.error("Error fetching vehicles:", error));

    const logsRef = collection(db, 'users', user.uid, 'logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(fetchedLogs);
    }, (error) => console.error("Error fetching logs:", error));

    const modsRef = collection(db, 'users', user.uid, 'mods');
    const unsubMods = onSnapshot(modsRef, (snapshot) => {
      const fetchedMods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMods(fetchedMods);
    }, (error) => console.error("Error fetching mods:", error));

    const maintRef = collection(db, 'users', user.uid, 'maintenance');
    const unsubMaint = onSnapshot(maintRef, (snapshot) => {
      const fetchedMaint = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMaintenanceLogs(fetchedMaint);
    }, (error) => console.error("Error fetching maintenance logs:", error));

    return () => {
      unsubVehicles();
      unsubLogs();
      unsubMods();
      unsubMaint();
    };
  }, [user]);

  // Derive active vehicle (fallback to first vehicle if none selected or selected one no longer exists)
  const activeVehicleIdResolved = (activeVehicleId && vehicles.some(v => v.id === activeVehicleId))
    ? activeVehicleId
    : (vehicles[0]?.id || '');

  const activeVehicle = useMemo(() => {
    return vehicles.find(v => v.id === activeVehicleIdResolved) || null;
  }, [vehicles, activeVehicleIdResolved]);

  // Derived current details merged with any in-progress draft edits
  const currentDetails = useMemo(() => {
    const draft = detailsDrafts[activeVehicleIdResolved] || {};
    return {
      nickname: draft.nickname !== undefined ? draft.nickname : (activeVehicle?.nickname || ''),
      vin: draft.vin !== undefined ? draft.vin : (activeVehicle?.vin || ''),
      trim: draft.trim !== undefined ? draft.trim : (activeVehicle?.trim || ''),
      color: draft.color !== undefined ? draft.color : (activeVehicle?.color || ''),
      purchaseDate: draft.purchaseDate !== undefined ? draft.purchaseDate : (activeVehicle?.purchaseDate || ''),
      purchaseMileage: draft.purchaseMileage !== undefined ? draft.purchaseMileage : (activeVehicle?.purchaseMileage !== undefined && activeVehicle?.purchaseMileage !== null ? activeVehicle.purchaseMileage : ''),
      purchasePrice: draft.purchasePrice !== undefined ? draft.purchasePrice : (activeVehicle?.purchasePrice !== undefined && activeVehicle?.purchasePrice !== null ? activeVehicle.purchasePrice : ''),
      note: draft.note !== undefined ? draft.note : (activeVehicle?.note || '')
    };
  }, [detailsDrafts, activeVehicleIdResolved, activeVehicle]);

  const updateDetailField = (field, value) => {
    setDetailsDrafts(prev => ({
      ...prev,
      [activeVehicleIdResolved]: {
        ...(prev[activeVehicleIdResolved] || {}),
        [field]: value
      }
    }));
  };

  // --- Vehicle Management (Cloud) ---
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    if (!user || !db) return;

    const vId = editingVehicleId || Math.random().toString(36).substr(2, 9);
    const existingData = editingVehicleId ? (vehicles.find(v => v.id === editingVehicleId) || {}) : {};
    const newVehicle = { 
      ...existingData,
      year: vehicleForm.year, 
      make: vehicleForm.make, 
      model: vehicleForm.model 
    };

    await setDoc(doc(db, 'users', user.uid, 'vehicles', vId), newVehicle, { merge: true });
    
    if (!editingVehicleId) {
      setActiveVehicleId(vId);
    }
    setVehicleForm({ year: '', make: '', model: '' });
    setEditingVehicleId(null);
    setIsAddingVehicle(false);
  };

  const editVehicle = (vehicle) => {
    setVehicleForm({ year: vehicle.year, make: vehicle.make, model: vehicle.model });
    setEditingVehicleId(vehicle.id);
    setIsAddingVehicle(true);
  };

  const deleteVehicle = async (id) => {
    if (!user || !db) return;
    if (window.confirm("Delete this vehicle and all its logs, mods, and maintenance records?")) {
      await deleteDoc(doc(db, 'users', user.uid, 'vehicles', id));
      
      const logsToDelete = logs.filter(l => l.vehicleId === id);
      for (const l of logsToDelete) {
        await deleteDoc(doc(db, 'users', user.uid, 'logs', l.id));
      }

      const modsToDelete = mods.filter(m => m.vehicleId === id);
      for (const m of modsToDelete) {
        await deleteDoc(doc(db, 'users', user.uid, 'mods', m.id));
      }

      const maintToDelete = maintenanceLogs.filter(m => m.vehicleId === id);
      for (const m of maintToDelete) {
        await deleteDoc(doc(db, 'users', user.uid, 'maintenance', m.id));
      }
    }
  };

  // --- Save Vehicle Details ---
  const handleSaveVehicleDetails = async (e) => {
    if (e) e.preventDefault();
    if (!user || !db || !activeVehicleIdResolved || !activeVehicle) return;
    setIsSavingDetails(true);
    try {
      const updatedVehicle = {
        ...activeVehicle,
        nickname: currentDetails.nickname,
        vin: currentDetails.vin,
        trim: currentDetails.trim,
        color: currentDetails.color,
        purchaseDate: currentDetails.purchaseDate,
        purchaseMileage: currentDetails.purchaseMileage !== '' ? parseFloat(currentDetails.purchaseMileage) || 0 : '',
        purchasePrice: currentDetails.purchasePrice !== '' ? parseFloat(currentDetails.purchasePrice) || 0 : '',
        note: currentDetails.note
      };
      await setDoc(doc(db, 'users', user.uid, 'vehicles', activeVehicleIdResolved), updatedVehicle, { merge: true });
      setDetailsSavedSuccess(true);
      setTimeout(() => setDetailsSavedSuccess(false), 2000);
    } catch (err) {
      console.error("Error saving vehicle details:", err);
    } finally {
      setIsSavingDetails(false);
    }
  };

  // --- Mods Management ---
  const currentVehicleMods = useMemo(() => {
    if (!activeVehicleId) return [];
    return mods
      .filter(m => m.vehicleId === activeVehicleId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [mods, activeVehicleId]);

  const handleAddMod = async (e) => {
    e.preventDefault();
    if (!user || !db || !activeVehicleId || !newModForm.category.trim()) return;
    const modId = Math.random().toString(36).substr(2, 9);
    await setDoc(doc(db, 'users', user.uid, 'mods', modId), {
      vehicleId: activeVehicleId,
      category: newModForm.category.trim(),
      specs: newModForm.specs.trim(),
      createdAt: new Date().toISOString()
    });
    setNewModForm({ category: '', specs: '' });
    setIsAddingMod(false);
  };

  const handleStartEditMod = (mod) => {
    setEditingModId(mod.id);
    setEditModForm({ category: mod.category || '', specs: mod.specs || '' });
  };

  const handleSaveEditMod = async (modId) => {
    if (!user || !db || !editModForm.category.trim()) return;
    await setDoc(doc(db, 'users', user.uid, 'mods', modId), {
      category: editModForm.category.trim(),
      specs: editModForm.specs.trim()
    }, { merge: true });
    setEditingModId(null);
  };

  const handleDeleteMod = async (modId) => {
    if (!user || !db) return;
    if (window.confirm("Are you sure you want to delete this mod?")) {
      await deleteDoc(doc(db, 'users', user.uid, 'mods', modId));
    }
  };

  // --- Maintenance Logs Management ---
  const currentVehicleMaintLogs = useMemo(() => {
    if (!activeVehicleId) return [];
    let items = maintenanceLogs.filter(m => m.vehicleId === activeVehicleId);
    items.sort((a, b) => {
      let aVal = a[maintSortConfig.key];
      let bVal = b[maintSortConfig.key];
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (maintSortConfig.key === 'mileage') {
        const aNum = parseFloat(aVal) || 0;
        const bNum = parseFloat(bVal) || 0;
        return maintSortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      if (aVal < bVal) return maintSortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return maintSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [maintenanceLogs, activeVehicleId, maintSortConfig]);

  const handleSaveMaintLog = async (e) => {
    e.preventDefault();
    if (!user || !db || !activeVehicleId) return;
    const mId = editingMaintId || Math.random().toString(36).substr(2, 9);
    const newMaint = {
      vehicleId: activeVehicleId,
      date: maintForm.date,
      item: maintForm.item,
      mileage: parseFloat(maintForm.mileage) || 0,
      performer: maintForm.performer || '',
      notes: maintForm.notes || '',
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', user.uid, 'maintenance', mId), newMaint);
    setIsMaintModalOpen(false);
    setEditingMaintId(null);
    setMaintForm({
      date: new Date().toISOString().split('T')[0],
      item: '',
      mileage: '',
      performer: '',
      notes: ''
    });
  };

  const openAddMaintModal = () => {
    setMaintForm({
      date: new Date().toISOString().split('T')[0],
      item: '',
      mileage: '',
      performer: '',
      notes: ''
    });
    setEditingMaintId(null);
    setIsMaintModalOpen(true);
  };

  const openEditMaintModal = (maint) => {
    setMaintForm({
      date: maint.date || new Date().toISOString().split('T')[0],
      item: maint.item || '',
      mileage: maint.mileage !== undefined && maint.mileage !== null ? maint.mileage : '',
      performer: maint.performer || '',
      notes: maint.notes || ''
    });
    setEditingMaintId(maint.id);
    setIsMaintModalOpen(true);
  };

  const handleDeleteMaintLog = async (id) => {
    if (!user || !db) return;
    if (window.confirm("Are you sure you want to delete this maintenance log?")) {
      await deleteDoc(doc(db, 'users', user.uid, 'maintenance', id));
      setSelectedMaintIds(prev => prev.filter(selId => selId !== id));
    }
  };

  const handleBulkDeleteMaint = async () => {
    if (!user || !db || selectedMaintIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedMaintIds.length} selected maintenance logs?`)) {
      for (const id of selectedMaintIds) {
        await deleteDoc(doc(db, 'users', user.uid, 'maintenance', id));
      }
      setSelectedMaintIds([]);
    }
  };

  const handleSelectAllMaint = (e) => {
    if (e.target.checked) {
      setSelectedMaintIds(currentVehicleMaintLogs.map(m => m.id));
    } else {
      setSelectedMaintIds([]);
    }
  };

  const handleSelectMaintRow = (id) => {
    setSelectedMaintIds(prev => 
      prev.includes(id) ? prev.filter(selId => selId !== id) : [...prev, id]
    );
  };

  const handleMaintSort = (key) => {
    let direction = 'asc';
    if (maintSortConfig.key === key && maintSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setMaintSortConfig({ key, direction });
  };


  // --- Log Management (Cloud) ---
  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!user || !db || !activeVehicleId) return;

    const newLogId = editingLogId || Math.random().toString(36).substr(2, 9);
    const newLog = {
      vehicleId: activeVehicleId,
      date: logForm.date,
      odo: parseFloat(logForm.odo) || 0,
      volume: parseFloat(logForm.volume) || 0,
      unitPrice: parseFloat(logForm.unitPrice) || 0,
      total: (parseFloat(logForm.volume) || 0) * (parseFloat(logForm.unitPrice) || 0),
      notes: logForm.notes
    };
    
    await setDoc(doc(db, 'users', user.uid, 'logs', newLogId), newLog);
    
    setLogForm({
      date: new Date().toISOString().split('T')[0],
      odo: '',
      volume: '',
      unitPrice: '',
      notes: ''
    });
    setEditingLogId(null);
  };

  const editLog = (log) => {
    setLogForm({
      date: log.date,
      odo: log.odo,
      volume: log.volume,
      unitPrice: log.unitPrice,
      notes: log.notes || ''
    });
    setEditingLogId(log.id);
  };

  const cancelEditLog = () => {
    setLogForm({
      date: new Date().toISOString().split('T')[0],
      odo: '',
      volume: '',
      unitPrice: '',
      notes: ''
    });
    setEditingLogId(null);
  };

  const deleteLog = async (id) => {
    if (!user || !db) return;
    if (window.confirm("Are you sure you want to delete this log?")) {
      await deleteDoc(doc(db, 'users', user.uid, 'logs', id));
      setSelectedLogIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (!user || !db || selectedLogIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedLogIds.length} selected logs?`)) {
      for (const id of selectedLogIds) {
        await deleteDoc(doc(db, 'users', user.uid, 'logs', id));
      }
      setSelectedLogIds([]);
    }
  };

  // --- CSV Import Logic ---
  const downloadTemplate = () => {
    const headers = "Date,Odometer,Gallons,PricePerGal,Notes\n";
    const dummyData = "2023-10-01,45000,12.5,3.50,First import log\n";
    const blob = new Blob([headers + dummyData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fuel_tracker_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user || !db || !activeVehicleId) return;

    setIsImporting(true);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
        
        // Skip the header row (index 0)
        for (let i = 1; i < rows.length; i++) {
          const columns = rows[i].split(',');
          
          let date = columns[0] ? columns[0].trim() : '--';
          // Convert mm/dd/yyyy to yyyy-mm-dd
          if (date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
              const m = parts[0].padStart(2, '0');
              const d = parts[1].padStart(2, '0');
              // handle 2 digit year if needed, assuming 4 digit here
              const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              date = `${y}-${m}-${d}`;
            }
          }

          const odo = parseFloat(columns[1]) || 0;
          const volume = parseFloat(columns[2]) || 0;
          const unitPrice = parseFloat(columns[3]) || 0;
          const notes = columns[4] ? columns[4].trim() : '';
          const total = volume * unitPrice;

          const newLogId = Math.random().toString(36).substr(2, 9);
          const newLog = {
            vehicleId: activeVehicleId,
            date: date,
            odo: odo,
            volume: volume,
            unitPrice: unitPrice,
            total: total,
            notes: notes
          };

          await setDoc(doc(db, 'users', user.uid, 'logs', newLogId), newLog);
        }
        
        setImportSuccess(true);
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportSuccess(false);
        }, 1500);

      } catch (err) {
        console.error("Import failed", err);
      } finally {
        setIsImporting(false);
        e.target.value = null; 
      }
    };
    reader.readAsText(file);
  };


  // --- Derived State (MPG Calculation & Display) ---
  const currentVehicleLogs = useMemo(() => {
    if (!activeVehicleId) return [];
    
    // Calculate distance/MPG in chronological order
    const sortedLogs = [...logs]
      .filter(l => l.vehicleId === activeVehicleId)
      .sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.odo || 0) - (b.odo || 0);
      });

    const logsWithStats = sortedLogs.map((log, index) => {
      if (index === 0 || !log.odo || !log.volume) {
        return { ...log, distance: 0, mpg: null }; 
      }
      const prevLog = sortedLogs[index - 1];
      
      // If the previous log has no odometer, we can't reliably calculate distance
      if (!prevLog.odo) {
        return { ...log, distance: 0, mpg: null };
      }

      const distance = log.odo - prevLog.odo;
      if (distance <= 0) {
        return { ...log, distance, mpg: null };
      }

      const mpg = distance / log.volume; 
      return { ...log, distance, mpg };
    });

    return logsWithStats;
  }, [logs, activeVehicleId]);

  // Sorting
  const displayLogs = useMemo(() => {
    let sortableItems = [...currentVehicleLogs];
    sortableItems.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sortableItems;
  }, [currentVehicleLogs, sortConfig]);

  // Pagination
  const paginatedLogs = useMemo(() => {
    if (pageSize === 'All') return displayLogs;
    const size = parseInt(pageSize, 10);
    const startIndex = (currentPage - 1) * size;
    return displayLogs.slice(startIndex, startIndex + size);
  }, [displayLogs, currentPage, pageSize]);

  const totalPages = pageSize === 'All' ? 1 : Math.max(1, Math.ceil(displayLogs.length / parseInt(pageSize, 10)));

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
    setSelectedLogIds([]);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLogIds(paginatedLogs.map(log => log.id));
    } else {
      setSelectedLogIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedLogIds(prev => 
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  // Current Odometer: view only, pulled from latest gas fill up
  const currentOdometer = useMemo(() => {
    if (!activeVehicleId || !logs || logs.length === 0) return null;
    const vehicleLogs = logs.filter(l => l.vehicleId === activeVehicleId && l.odo > 0);
    if (vehicleLogs.length === 0) return null;

    const sorted = [...vehicleLogs].sort((a, b) => {
      const dateComp = (b.date || '').localeCompare(a.date || '');
      if (dateComp !== 0) return dateComp;
      return (b.odo || 0) - (a.odo || 0);
    });
    return sorted[0]?.odo || null;
  }, [logs, activeVehicleId]);

  // --- Derived Vehicle Stats ---
  const vehicleStats = useMemo(() => {
    if (!activeVehicleId || !currentVehicleLogs) return { lifetimeMPG: '0.00', bestMPG: '0.00', totalSpent: '0.00' };
    
    let totalDistance = 0;
    let totalVolumeForMPG = 0;
    let bestMPG = 0;
    let totalSpent = 0;

    currentVehicleLogs.forEach(log => {
      totalSpent += log.total || 0;
      if (log.mpg) {
        totalDistance += log.distance;
        totalVolumeForMPG += log.volume;
        if (log.mpg > bestMPG) bestMPG = log.mpg;
      }
    });

    const lifetimeMPG = totalVolumeForMPG > 0 ? (totalDistance / totalVolumeForMPG) : 0;
    
    return {
      lifetimeMPG: lifetimeMPG.toFixed(2),
      bestMPG: bestMPG.toFixed(2),
      totalSpent: totalSpent.toFixed(2)
    };
  }, [currentVehicleLogs, activeVehicleId]);

  const chartData = useMemo(() => {
    if (!currentVehicleLogs) return [];
    return currentVehicleLogs
      .filter(l => l.mpg !== null)
      .map(l => {
        // Prevent timezone shift by appending time
        const d = new Date(l.date + 'T12:00:00'); 
        const formattedDate = !isNaN(d) ? `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}` : l.date;
        return {
          date: formattedDate,
          mpg: parseFloat(l.mpg.toFixed(2))
        };
      });
  }, [currentVehicleLogs]);

  if (dbLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-400">
        <Loader2 size={40} className="animate-spin" />
      </div>
    );
  }

  // If the user is NOT logged in, show the Landing Page
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-6">
          <div className="flex justify-center mb-2">
            <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-4xl">
              🏎️
            </div>
          </div>
          <div>
            <h1 
              className="text-3xl sm:text-4xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 tracking-wide"
              style={{ fontFamily: "'Righteous', 'Russo One', sans-serif" }}
            >
              VIRTUAL GARAGE FOR NERD
            </h1>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Track vehicle specs, mods, maintenance logs, and fuel efficiency all in one enthusiast hub.
            </p>
          </div>
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-3.5 px-4 rounded-xl font-bold hover:bg-slate-100 transition-all shadow-lg hover:shadow-blue-500/10 cursor-pointer"
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google logo" 
              className="w-5 h-5"
            />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8 relative">
      
      {/* CSV Import Modal (Fuel tracker) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md p-6 space-y-6 relative">
            <button 
              onClick={() => setIsImportModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
              disabled={isImporting}
            >
              <X size={20} />
            </button>
            
            <div>
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Upload size={20} className="text-blue-400" />
                Import CSV Data
              </h3>
              <p className="text-sm text-slate-400">
                Upload a CSV file to bulk import fuel logs for your <span className="font-semibold text-slate-200">{activeVehicle?.year} {activeVehicle?.make} {activeVehicle?.model}</span>.
              </p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 bg-slate-700/50 text-slate-300 border border-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
                disabled={isImporting}
              >
                <Download size={16} /> Download CSV Template
              </button>
              
              <div className="relative w-full">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleCsvUpload}
                  disabled={isImporting}
                  className={`absolute inset-0 w-full h-full opacity-0 ${isImporting ? 'cursor-not-allowed' : 'cursor-pointer'} z-10`}
                />
                <div className={`w-full flex items-center justify-center gap-2 font-medium py-2.5 rounded-xl transition-all border
                  ${importSuccess ? 'bg-green-500/20 text-green-400 border-green-500/50' : 
                    isImporting ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : 
                    'bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500 hover:text-white'}`}>
                  {importSuccess ? (
                    <><Check size={16} /> Import Complete!</>
                  ) : isImporting ? (
                    <><Loader2 size={16} className="animate-spin" /> Importing...</>
                  ) : (
                    <><Upload size={16} /> Select & Upload CSV</>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance / Repair Log Modal */}
      {isMaintModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg p-6 space-y-5 relative">
            <button 
              onClick={() => { setIsMaintModalOpen(false); setEditingMaintId(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Wrench size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {editingMaintId ? 'Edit Maintenance / Repair Log' : 'Add Maintenance / Repair Log'}
                </h3>
                <p className="text-xs text-slate-400">
                  {activeVehicle ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}` : 'Vehicle Service Record'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveMaintLog} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Service Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 text-slate-500 pointer-events-none" size={16} />
                    <input 
                      type="date" 
                      required 
                      value={maintForm.date} 
                      onChange={e => setMaintForm({ ...maintForm, date: e.target.value })} 
                      onClick={e => { if (e.target.showPicker) e.target.showPicker(); }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm focus:border-emerald-500 outline-none text-slate-200 cursor-pointer" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Mileage *</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-2.5 text-slate-500 pointer-events-none" size={16} />
                    <input 
                      type="number" 
                      required 
                      placeholder="e.g. 45000" 
                      value={maintForm.mileage} 
                      onChange={e => setMaintForm({ ...maintForm, mileage: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm focus:border-emerald-500 outline-none text-slate-200" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Maintenance / Repair Item *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Oil change & filter, Front brake pads, Spark plugs" 
                  value={maintForm.item} 
                  onChange={e => setMaintForm({ ...maintForm, item: e.target.value })} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 outline-none text-slate-200" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Performer (Car shop or DIY)</label>
                <input 
                  type="text" 
                  placeholder="e.g. DIY, Dealership, Speed Shop, Precision Auto" 
                  value={maintForm.performer} 
                  onChange={e => setMaintForm({ ...maintForm, performer: e.target.value })} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 outline-none text-slate-200" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notes (Optional)</label>
                <textarea 
                  rows={3}
                  placeholder="Part numbers, fluid types/weight, torque specs, cost, warranty..." 
                  value={maintForm.notes} 
                  onChange={e => setMaintForm({ ...maintForm, notes: e.target.value })} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-emerald-500 outline-none text-slate-200 resize-none" 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="submit" 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {editingMaintId ? 'Update Log' : 'Save Log'}
                </button>
                <button 
                  type="button" 
                  onClick={() => { setIsMaintModalOpen(false); setEditingMaintId(null); }}
                  className="px-5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        {/* Top App Title Header */}
        <div className="text-center pt-2 pb-1">
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 drop-shadow-[0_2px_12px_rgba(59,130,246,0.3)]"
            style={{ fontFamily: "'Righteous', 'Russo One', sans-serif" }}
          >
            VIRTUAL GARAGE FOR NERD
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium tracking-wide flex items-center justify-center gap-2">
            <span>THE ENTHUSIAST VEHICLE HUB</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>STATS • MODS • MAINTENANCE</span>
          </p>
        </div>

        {/* 1st Tile: Sliding Feature Switcher & User Action Bar */}
        <header className="bg-slate-800 p-4 md:p-5 rounded-2xl shadow-lg border border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Sliding Selection Toggle */}
          <div className="relative flex items-center bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/80 shadow-inner w-full md:w-auto md:min-w-[440px]">
            {/* Sliding background pill indicator */}
            <div 
              className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-lg transition-all duration-300 ease-out shadow-md ${
                activeTab === 'garage' 
                  ? 'left-1.5 bg-gradient-to-r from-blue-600 to-indigo-600' 
                  : 'left-[calc(50%+3px)] bg-gradient-to-r from-emerald-600 to-teal-600'
              }`}
            />
            
            {/* Option 1: My Garage (Left) */}
            <button
              type="button"
              onClick={() => handleTabChange('garage')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-colors duration-200 cursor-pointer ${
                activeTab === 'garage' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Car size={18} className={activeTab === 'garage' ? 'text-white' : 'text-blue-400'} />
              <span>My Garage</span>
            </button>

            {/* Option 2: Fuel & MPG Tracker (Right) */}
            <button
              type="button"
              onClick={() => handleTabChange('fuel')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-colors duration-200 cursor-pointer ${
                activeTab === 'fuel' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Fuel size={18} className={activeTab === 'fuel' ? 'text-white' : 'text-emerald-400'} />
              <span>Fuel & MPG Tracker</span>
            </button>
          </div>

          {/* User Profile & Sign Out Button */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {user?.email && (
              <span className="text-xs text-slate-400 hidden sm:inline truncate max-w-[220px]" title={user.email}>
                {user.email}
              </span>
            )}
            <button 
              onClick={handleSignOut}
              className="px-4 py-2 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-xl border border-slate-600 transition-colors shadow-sm cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Top Cards Row: My Vehicle (2nd tile) & Right Card (Vehicle Details OR Add Fill-up) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          
          {/* 2nd Tile: My Vehicle Card */}
          <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col h-[440px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Car size={20} className="text-blue-400"/> My Vehicle
              </h2>
              {!isAddingVehicle && (
                <button 
                  onClick={() => setIsAddingVehicle(true)}
                  className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors cursor-pointer"
                  title="Add Vehicle"
                >
                  <Plus size={18} />
                </button>
              )}
            </div>

            {isAddingVehicle ? (
              <form onSubmit={handleSaveVehicle} className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Year</label>
                  <input type="number" placeholder="e.g. 2024" required value={vehicleForm.year} onChange={e => setVehicleForm({...vehicleForm, year: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Make</label>
                  <input type="text" placeholder="e.g. Honda, Ford, Porsche" required value={vehicleForm.make} onChange={e => setVehicleForm({...vehicleForm, make: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Model</label>
                  <input type="text" placeholder="e.g. Civic Type R, Mustang GT" required value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 bg-blue-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer">Save</button>
                  <button type="button" onClick={() => { setIsAddingVehicle(false); setEditingVehicleId(null); }} className="flex-1 bg-slate-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-slate-600 transition-colors cursor-pointer">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="space-y-2 flex-1 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-600 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full">
                {vehicles.map(v => (
                  <div key={v.id} className="flex flex-col mb-2">
                    <div 
                      onClick={() => setActiveVehicleId(v.id)}
                      className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer hover:border-blue-500/50 transition-all ${activeVehicleId === v.id ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-slate-900/50 border-slate-700'}`}
                    >
                      <div>
                        <span className="text-sm font-semibold">{v.year} {v.make} {v.model}</span>
                        {v.nickname && (
                          <span className="ml-2 text-xs text-indigo-400 italic">"{v.nickname}"</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); editVehicle(v); }} className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer" title="Edit Vehicle"><Edit2 size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteVehicle(v.id); }} className="p-1.5 text-red-400 hover:text-red-300 transition-colors cursor-pointer" title="Delete Vehicle"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    {activeVehicleId === v.id && (
                      <div className="mt-2 p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-sm space-y-2">
                        {/* In My Garage mode: Current Odometer pulled from last gas fill up, above Lifetime MPG */}
                        {activeTab === 'garage' && (
                          <div className="flex justify-between text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Gauge size={14} className="text-emerald-400" /> Current Odometer
                            </span> 
                            <span className="text-emerald-400 font-semibold">
                              {currentOdometer !== null ? `${currentOdometer.toLocaleString()} mi` : '--'}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-400">
                          <span>Lifetime MPG</span> 
                          <span className="text-white font-semibold">{vehicleStats.lifetimeMPG}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Best MPG</span> 
                          <span className="text-blue-400 font-semibold">{vehicleStats.bestMPG}</span>
                        </div>
                        {/* In Fuel & MPG Tracker mode only: Total Spent on Gas */}
                        {activeTab === 'fuel' && (
                          <div className="flex justify-between text-slate-400">
                            <span>Total Spent on Gas</span> 
                            <span className="text-green-400 font-semibold">${vehicleStats.totalSpent}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {vehicles.length === 0 && (
                  <div className="text-center py-10 text-slate-500 italic space-y-2">
                    <p>No vehicles in garage yet.</p>
                    <button 
                      onClick={() => setIsAddingVehicle(true)}
                      className="text-sm text-blue-400 hover:underline cursor-pointer"
                    >
                      + Add your first vehicle
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Card: Vehicle Details (My Garage mode) OR Add Fill-up (Fuel mode) */}
          {activeTab === 'garage' ? (
            /* Vehicle Details Card */
            <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col h-[440px]">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles size={20} className="text-blue-400" /> Vehicle Details
                </h2>
                {activeVehicle && (
                  <button 
                    onClick={handleSaveVehicleDetails}
                    disabled={isSavingDetails}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/40 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {detailsSavedSuccess ? (
                      <><Check size={14} className="text-green-400" /> Saved!</>
                    ) : isSavingDetails ? (
                      <><Loader2 size={14} className="animate-spin" /> Saving...</>
                    ) : (
                      <><Save size={14} /> Save Details</>
                    )}
                  </button>
                )}
              </div>

              {activeVehicle ? (
                <form onSubmit={handleSaveVehicleDetails} className="space-y-3 flex-1 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-600 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Nickname</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Daily Missile, Track Toy" 
                        value={currentDetails.nickname} 
                        onChange={e => updateDetailField('nickname', e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none text-slate-200" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Trim</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Type R, GT, Rubicon" 
                        value={currentDetails.trim} 
                        onChange={e => updateDetailField('trim', e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none text-slate-200" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">VIN</label>
                      <input 
                        type="text" 
                        placeholder="17-character VIN" 
                        value={currentDetails.vin} 
                        onChange={e => updateDetailField('vin', e.target.value.toUpperCase())} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none font-mono text-slate-200 uppercase" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Color</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Championship White, Boosted Blue" 
                        value={currentDetails.color} 
                        onChange={e => updateDetailField('color', e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none text-slate-200" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Purchase Date</label>
                      <input 
                        type="date" 
                        value={currentDetails.purchaseDate} 
                        onChange={e => updateDetailField('purchaseDate', e.target.value)} 
                        onClick={e => { if (e.target.showPicker) e.target.showPicker(); }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none text-slate-200 cursor-pointer" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Mileage When Purchased</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 15000" 
                        value={currentDetails.purchaseMileage} 
                        onChange={e => updateDetailField('purchaseMileage', e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none text-slate-200" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Purchase Price ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2 text-slate-500 pointer-events-none" size={15} />
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="e.g. 35000" 
                        value={currentDetails.purchasePrice} 
                        onChange={e => updateDetailField('purchasePrice', e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:border-blue-500 outline-none text-slate-200" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Note</label>
                    <textarea 
                      rows={2}
                      placeholder="Factory packages, options, history, or nerd notes..." 
                      value={currentDetails.note} 
                      onChange={e => updateDetailField('note', e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none text-slate-200 resize-none" 
                    />
                  </div>
                </form>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 italic">
                  <Car size={36} className="mb-2 opacity-40 text-blue-400" />
                  <p>Select or add a vehicle on the left to view and edit its details.</p>
                </div>
              )}
            </div>
          ) : (
            /* Add Fill-up Card (Fuel & MPG Tracker mode) */
            activeVehicleId ? (
              <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col h-[440px]">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Fuel size={20} className="text-green-400"/> {editingLogId ? 'Edit Fill-up' : 'Add Fill-up'}
                </h2>
                <form onSubmit={handleAddLog} className="space-y-4 flex flex-col flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 text-slate-500 pointer-events-none" size={16} />
                        <input 
                          type="date" 
                          required 
                          value={logForm.date} 
                          onChange={e => setLogForm({...logForm, date: e.target.value})} 
                          onClick={e => { if (e.target.showPicker) e.target.showPicker(); }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-green-500 outline-none cursor-pointer" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Odometer</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-2.5 text-slate-500" size={16} />
                        <input type="number" step="0.1" required value={logForm.odo} onChange={e => setLogForm({...logForm, odo: e.target.value})} placeholder="e.g. 45000" className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-green-500 outline-none" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Gallons</label>
                      <input type="number" step="0.001" required value={logForm.volume} onChange={e => setLogForm({...logForm, volume: e.target.value})} placeholder="e.g. 12.5" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-green-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Price/Gal</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 text-slate-500" size={16} />
                        <input type="number" step="0.01" required value={logForm.unitPrice} onChange={e => setLogForm({...logForm, unitPrice: e.target.value})} placeholder="3.50" className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm focus:border-green-500 outline-none" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Notes (Optional)</label>
                    <input type="text" value={logForm.notes} onChange={e => setLogForm({...logForm, notes: e.target.value})} placeholder="e.g. Costco, Road Trip..." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-green-500 outline-none" />
                  </div>
                  
                  <div className="mt-auto space-y-4">
                    {logForm.volume && logForm.unitPrice && (
                      <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700 flex justify-between items-center">
                        <span className="text-sm text-slate-400">Total Cost:</span>
                        <span className="font-bold text-green-400">${(logForm.volume * logForm.unitPrice).toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-green-500/20 text-green-400 border border-green-500/50 font-semibold py-2.5 rounded-xl hover:bg-green-500 hover:text-white transition-all cursor-pointer">
                        {editingLogId ? 'Update Fill-up' : 'Save Fill-up'}
                      </button>
                      {editingLogId && (
                        <button type="button" onClick={cancelEditLog} className="flex-1 bg-slate-700/50 text-slate-300 border border-slate-600 font-semibold py-2.5 rounded-xl hover:bg-slate-600 transition-all cursor-pointer">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col h-[440px] items-center justify-center text-center text-slate-500 italic">
                <Fuel size={36} className="mb-2 opacity-40 text-green-400" />
                <p>Select or add a vehicle on the left to start logging fill-ups.</p>
              </div>
            )
          )}

        </div>

        {/* --- DYNAMIC LOWER TILES BASED ON ACTIVE TAB --- */}

        {activeTab === 'garage' ? (
          /* =================== MY GARAGE TILES =================== */
          <div className="space-y-6 md:space-y-8">
            
            {/* Large Tile: Mods */}
            <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Wrench size={20} className="text-purple-400" /> Mods & Upgrades {activeVehicle ? `- ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}` : ''}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Document aftermarket parts, tuning, wheels, cosmetics, and modifications.
                  </p>
                </div>
                
                {activeVehicleId && !isAddingMod && (
                  <button 
                    onClick={() => setIsAddingMod(true)}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600 hover:text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
                  >
                    <Plus size={16} /> Add Mod
                  </button>
                )}
              </div>

              {/* Add Mod Input Row */}
              {isAddingMod && (
                <form onSubmit={handleAddMod} className="p-4 bg-slate-900/80 border border-purple-500/40 rounded-xl mb-5 space-y-3 shadow-md">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="w-full md:w-1/3">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Field / Mod Type</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Exhaust, Wheels, Suspension, Tune" 
                        value={newModForm.category} 
                        onChange={e => setNewModForm({ ...newModForm, category: e.target.value })} 
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none text-slate-200" 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Value / Specs / Model</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Borla S-Type Cat-Back, Enkei RPF1 18x9.5 +38, Stage 1 ECU tune" 
                        value={newModForm.specs} 
                        onChange={e => setNewModForm({ ...newModForm, specs: e.target.value })} 
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none text-slate-200" 
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button 
                      type="submit" 
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Save Mod
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setIsAddingMod(false); setNewModForm({ category: '', specs: '' }); }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Saved Mods List */}
              <div className="space-y-2.5">
                {currentVehicleMods.map(mod => (
                  <div 
                    key={mod.id} 
                    className="p-3.5 bg-slate-900/50 hover:bg-slate-900/80 border border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    {editingModId === mod.id ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                        <input 
                          type="text" 
                          value={editModForm.category} 
                          onChange={e => setEditModForm({ ...editModForm, category: e.target.value })} 
                          className="w-full sm:w-1/3 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:border-purple-500 outline-none text-slate-200" 
                          placeholder="Mod type"
                        />
                        <input 
                          type="text" 
                          value={editModForm.specs} 
                          onChange={e => setEditModForm({ ...editModForm, specs: e.target.value })} 
                          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:border-purple-500 outline-none text-slate-200" 
                          placeholder="Specs or details"
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleSaveEditMod(mod.id)} 
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setEditingModId(null)} 
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1">
                          <span className="px-3 py-1 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap self-start sm:self-auto">
                            {mod.category}
                          </span>
                          <span className="text-sm font-medium text-slate-200 leading-snug">
                            {mod.specs}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button 
                            onClick={() => handleStartEditMod(mod)} 
                            className="p-1.5 text-slate-400 hover:text-purple-300 transition-colors cursor-pointer" 
                            title="Edit Mod"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteMod(mod.id)} 
                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors cursor-pointer" 
                            title="Delete Mod"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {currentVehicleMods.length === 0 && (
                  <div className="text-center py-8 text-slate-500 italic">
                    <p>No mods logged yet for this vehicle.</p>
                    {activeVehicleId && (
                      <button 
                        onClick={() => setIsAddingMod(true)}
                        className="text-xs text-purple-400 hover:underline mt-1 cursor-pointer"
                      >
                        + Click here to add your first mod
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Final Large Tile: Maintenance / Repair Logs */}
            <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Wrench size={20} className="text-emerald-400" /> Maintenance / Repair Logs {activeVehicle ? `- ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}` : ''}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Keep a verifiable history of all DIY tasks, dealer services, and repairs.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  {selectedMaintIds.length > 0 && (
                    <button 
                      onClick={handleBulkDeleteMaint}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 text-sm font-medium rounded-lg border border-red-500/30 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                    >
                      <Trash2 size={16} /> Delete Selected ({selectedMaintIds.length})
                    </button>
                  )}
                  {activeVehicleId && (
                    <button 
                      onClick={openAddMaintModal}
                      className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/20 text-emerald-400 text-sm font-semibold rounded-lg border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                    >
                      <Plus size={16} /> Add Log
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-4 w-12">
                        <input 
                          type="checkbox" 
                          className="cursor-pointer w-4 h-4 rounded border-slate-600 bg-slate-900 accent-emerald-500"
                          checked={currentVehicleMaintLogs.length > 0 && selectedMaintIds.length === currentVehicleMaintLogs.length}
                          onChange={handleSelectAllMaint}
                        />
                      </th>
                      <th className="px-6 py-4 font-semibold cursor-pointer hover:text-white transition-colors" onClick={() => handleMaintSort('date')}>
                        Date <SortIndicator sortKey={maintSortConfig.key} column="date" direction={maintSortConfig.direction} />
                      </th>
                      <th className="px-6 py-4 font-semibold cursor-pointer hover:text-white transition-colors" onClick={() => handleMaintSort('item')}>
                        Maintenance <SortIndicator sortKey={maintSortConfig.key} column="item" direction={maintSortConfig.direction} />
                      </th>
                      <th className="px-6 py-4 font-semibold text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleMaintSort('mileage')}>
                        Mileage <SortIndicator sortKey={maintSortConfig.key} column="mileage" direction={maintSortConfig.direction} />
                      </th>
                      <th className="px-6 py-4 font-semibold cursor-pointer hover:text-white transition-colors" onClick={() => handleMaintSort('performer')}>
                        Performer (Car shop or DIY) <SortIndicator sortKey={maintSortConfig.key} column="performer" direction={maintSortConfig.direction} />
                      </th>
                      <th className="px-6 py-4 font-semibold">Notes</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentVehicleMaintLogs.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-10 text-center text-slate-500 italic">
                          No maintenance or repair logs found for this vehicle.
                        </td>
                      </tr>
                    ) : (
                      currentVehicleMaintLogs.map(maint => (
                        <tr key={maint.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              className="cursor-pointer w-4 h-4 rounded border-slate-600 bg-slate-900 accent-emerald-500"
                              checked={selectedMaintIds.includes(maint.id)}
                              onChange={() => handleSelectMaintRow(maint.id)}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-300 font-medium">
                            {maint.date || '--'}
                          </td>
                          <td className="px-6 py-4 text-white font-semibold">
                            {maint.item}
                          </td>
                          <td className="px-6 py-4 text-right text-emerald-400 font-semibold whitespace-nowrap">
                            {maint.mileage ? `${maint.mileage.toLocaleString()} mi` : '--'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                            {maint.performer ? (
                              <span className="px-2.5 py-1 bg-slate-700/60 border border-slate-600 rounded-md text-xs font-medium text-slate-300">
                                {maint.performer}
                              </span>
                            ) : (
                              '--'
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-400 max-w-xs truncate" title={maint.notes}>
                            {maint.notes || '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-3">
                              <button 
                                onClick={() => openEditMaintModal(maint)} 
                                className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer" 
                                title="Edit Log"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteMaintLog(maint.id)} 
                                className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer" 
                                title="Delete Log"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          /* =================== FUEL & MPG TRACKER TILES =================== */
          <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                History & Performance {activeVehicle ? `- ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}` : ''}
              </h2>
              
              <div className="flex gap-2">
                {selectedLogIds.length > 0 && (
                  <button 
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 text-sm font-medium rounded-lg border border-red-500/30 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                  >
                    <Trash2 size={16} /> Delete Selected ({selectedLogIds.length})
                  </button>
                )}
                {activeVehicleId && (
                  <button 
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 text-sm font-medium rounded-lg border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all cursor-pointer"
                  >
                    <Upload size={16} /> Import CSV
                  </button>
                )}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="cursor-pointer w-4 h-4 rounded border-slate-600 bg-slate-900 accent-blue-500"
                        checked={paginatedLogs.length > 0 && selectedLogIds.length === paginatedLogs.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4 font-semibold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('date')}>
                      Date <SortIndicator sortKey={sortConfig.key} column="date" direction={sortConfig.direction} />
                    </th>
                    <th className="px-6 py-4 font-semibold text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('odo')}>
                      Odometer <SortIndicator sortKey={sortConfig.key} column="odo" direction={sortConfig.direction} />
                    </th>
                    <th className="px-6 py-4 font-semibold text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('volume')}>
                      Gallons <SortIndicator sortKey={sortConfig.key} column="volume" direction={sortConfig.direction} />
                    </th>
                    <th className="px-6 py-4 font-semibold text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('total')}>
                      Cost <SortIndicator sortKey={sortConfig.key} column="total" direction={sortConfig.direction} />
                    </th>
                    <th className="px-6 py-4 font-semibold text-right text-blue-400 cursor-pointer hover:text-blue-300 transition-colors" onClick={() => handleSort('mpg')}>
                      MPG <SortIndicator sortKey={sortConfig.key} column="mpg" direction={sortConfig.direction} />
                    </th>
                    <th className="px-6 py-4 font-semibold">Notes</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-slate-500">
                        No fill-ups found for this page/vehicle.
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                        <td className="px-6 py-4">
                           <input 
                            type="checkbox" 
                            className="cursor-pointer w-4 h-4 rounded border-slate-600 bg-slate-900 accent-blue-500"
                            checked={selectedLogIds.includes(log.id)}
                            onChange={() => handleSelectRow(log.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">{log.date || '--'}</td>
                        <td className="px-6 py-4 text-right font-medium">{log.odo > 0 ? log.odo.toLocaleString() : '--'}</td>
                        <td className="px-6 py-4 text-right text-slate-400">{log.volume > 0 ? log.volume.toFixed(3) : '--'}</td>
                        <td className="px-6 py-4 text-right text-green-400">{log.total > 0 ? `$${log.total.toFixed(2)}` : '--'}</td>
                        <td className="px-6 py-4 text-right font-bold text-blue-400">
                          {log.mpg ? (
                            <div className="flex flex-col items-end">
                              <span>{log.mpg.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-500 font-normal">+{log.distance.toFixed(1)} mi</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs font-normal">
                              {log.volume > 0 ? 'N/A' : 'N/A'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-400 max-w-xs truncate" title={log.notes}>
                          {log.notes || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            <button onClick={() => editLog(log)} className="text-slate-500 hover:text-blue-400 transition-colors cursor-pointer" title="Edit">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => deleteLog(log.id)} className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400 bg-slate-800/50">
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select 
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg p-1.5 focus:border-blue-500 outline-none"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="All">All</option>
                </select>
                <span>per page</span>
              </div>
              
              <div className="flex items-center gap-4">
                <span>
                  Page {pageSize === 'All' ? 1 : currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || pageSize === 'All'}
                    className="p-1.5 rounded-lg border border-slate-600 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || pageSize === 'All'}
                    className="p-1.5 rounded-lg border border-slate-600 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Trend Graph */}
            {chartData.length > 1 && (
              <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden flex flex-col p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
                  <TrendingUp className="text-blue-400" size={20} /> Average MPG Over Time
                </h2>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMpg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8" 
                        tick={{ fill: '#94a3b8', fontSize: 12 }} 
                        tickMargin={10} 
                        minTickGap={30}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        tick={{ fill: '#94a3b8', fontSize: 12 }} 
                        domain={[0, 'dataMax + 10']}
                        tickCount={6}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.5rem', color: '#f8fafc' }}
                        itemStyle={{ color: '#60a5fa' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="mpg" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorMpg)" 
                        name="Average MPG"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}