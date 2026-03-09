import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import { RaceCarRowSchema } from '@/lib/validators';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';


export interface RaceCar {
  id: string;
  userId?: string;
  carNumber: string;
  nickname: string;
  class: string;
  year: number | null;
  make: string;
  model: string;
  color: string;
  isActive: boolean;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CarMutationResult {
  success: boolean;
  error?: string;
}

interface CarContextType {
  cars: RaceCar[];
  selectedCarId: string | null; // null = "All Cars"
  isLoading: boolean;
  addCar: (car: Omit<RaceCar, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<CarMutationResult>;
  updateCar: (id: string, updates: Partial<RaceCar>) => Promise<CarMutationResult>;
  deleteCar: (id: string) => Promise<CarMutationResult>;
  setSelectedCarId: (id: string | null) => void;
  getCarById: (id: string) => RaceCar | undefined;
  getCarLabel: (id: string | null) => string;
  activeCars: RaceCar[];
  refreshCars: () => Promise<void>;
}

const CarContext = createContext<CarContextType | undefined>(undefined);

const toRaceCar = (row: any): RaceCar => ({
  id: row.id,
  userId: row.user_id,
  carNumber: row.car_number || '',
  nickname: row.nickname || '',
  class: row.class || '',
  year: row.year || null,
  make: row.make || '',
  model: row.model || '',
  color: row.color || '',
  isActive: row.is_active ?? true,
  notes: row.notes || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const CarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isDemoMode, effectiveUserId } = useAuth();
  const [cars, setCars] = useState<RaceCar[]>([]);
  const [selectedCarId, setSelectedCarIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load cars from DB
  const refreshCars = useCallback(async () => {
    const userId = effectiveUserId || user?.id;
    if (!userId && !isDemoMode) return;
    
    if (isDemoMode) {
      // In demo mode, load from localStorage
      try {
        const saved = localStorage.getItem('demo_race_cars');
        if (saved) setCars(JSON.parse(saved));
      } catch {}
      return;
    }

    setIsLoading(true);
    try {
      console.log('[CarContext] Loading cars for user_id:', userId);
      const { data, error } = await supabase
        .from('race_cars')
        .select('*')
        .eq('user_id', userId)
        .order('car_number');
      
      if (error) {
        console.error('[CarContext] Error loading cars:', error.message, error.details, error.hint);
        throw error;
      }
      console.log('[CarContext] Loaded', data?.length || 0, 'cars from database');
      if (mountedRef.current) {
        const loadedCars = parseRows(data, RaceCarRowSchema, 'race_cars').map(toRaceCar);
        setCars(loadedCars);

        // Auto-select: if only one car, select it; if multiple, default to All Cars
        if (loadedCars.length === 1) {
          setSelectedCarIdState(loadedCars[0].id);
        }
      }
    } catch (err) {
      console.error('[CarContext] Error loading cars:', err);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [user?.id, effectiveUserId, isDemoMode]);

  // Load on mount and when user changes
  useEffect(() => {
    refreshCars();
  }, [refreshCars]);

  // Persist selected car to localStorage
  const setSelectedCarId = useCallback((id: string | null) => {
    setSelectedCarIdState(id);
    try {
      if (id) {
        localStorage.setItem('selected_car_id', id);
      } else {
        localStorage.removeItem('selected_car_id');
      }
    } catch {}
  }, []);

  // Restore selected car from localStorage on load
  useEffect(() => {
    if (cars.length === 0) return;
    try {
      const saved = localStorage.getItem('selected_car_id');
      if (saved && cars.find(c => c.id === saved)) {
        setSelectedCarIdState(saved);
      } else if (cars.length === 1) {
        setSelectedCarIdState(cars[0].id);
      }
    } catch {}
  }, [cars]);

  const addCar = useCallback(async (carData: Omit<RaceCar, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<CarMutationResult> => {
    const userId = effectiveUserId || user?.id;
    
    // Validate user_id before attempting insert
    if (!userId && !isDemoMode) {
      const errorMsg = 'You must be signed in to add a car. Please sign in and try again.';
      console.error('[CarContext] addCar failed: no user_id available. user?.id:', user?.id, 'effectiveUserId:', effectiveUserId);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const newId = crypto.randomUUID();
    
    const newCar: RaceCar = {
      ...carData,
      id: newId,
      userId: userId,
    };

    // Demo mode: save to localStorage
    if (isDemoMode) {
      setCars(prev => {
        const updated = [...prev, newCar];
        try {
          localStorage.setItem('demo_race_cars', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      toast.success('Car added successfully');
      return { success: true };
    }

    // Optimistic update
    setCars(prev => [...prev, newCar]);

    try {
      console.log('[CarContext] Inserting car into race_cars table:', {
        id: newId,
        user_id: userId,
        car_number: carData.carNumber || null,
        nickname: carData.nickname || null,
        class: carData.class || null,
      });

      const { data, error } = await supabase.from('race_cars').insert({
        id: newId,
        user_id: userId,
        car_number: carData.carNumber || null,
        nickname: carData.nickname || null,
        class: carData.class || null,
        year: carData.year || null,
        make: carData.make || null,
        model: carData.model || null,
        color: carData.color || null,
        is_active: carData.isActive,
        notes: carData.notes || null,
      }).select();

      if (error) {
        console.error('[CarContext] Supabase insert error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }

      console.log('[CarContext] Car inserted successfully:', data);
      
      // Refresh from DB to ensure we have the correct server-generated timestamps
      await refreshCars();
      
      toast.success('Car added successfully');
      return { success: true };
    } catch (err: any) {
      console.error('[CarContext] Error adding car:', err);
      
      // Rollback optimistic update
      setCars(prev => prev.filter(c => c.id !== newId));
      
      // Build a detailed error message
      let errorMsg = 'Failed to save car to database.';
      if (err?.message) {
        errorMsg += ` Error: ${err.message}`;
      }
      if (err?.details) {
        errorMsg += ` Details: ${err.details}`;
      }
      if (err?.hint) {
        errorMsg += ` Hint: ${err.hint}`;
      }
      if (err?.code === '42501') {
        errorMsg = 'Permission denied. Please sign out and sign back in, then try again.';
      }
      if (err?.code === '23505') {
        errorMsg = 'A car with this ID already exists. Please try again.';
      }
      
      toast.error(errorMsg, { duration: 8000 });
      return { success: false, error: errorMsg };
    }
  }, [user?.id, effectiveUserId, isDemoMode, refreshCars]);

  const updateCar = useCallback(async (id: string, updates: Partial<RaceCar>): Promise<CarMutationResult> => {
    const prevCars = [...cars];
    
    // Optimistic update
    setCars(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    if (isDemoMode) {
      try {
        const updated = cars.map(c => c.id === id ? { ...c, ...updates } : c);
        localStorage.setItem('demo_race_cars', JSON.stringify(updated));
      } catch {}
      toast.success('Car updated');
      return { success: true };
    }

    try {
      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.carNumber !== undefined) payload.car_number = updates.carNumber || null;
      if (updates.nickname !== undefined) payload.nickname = updates.nickname || null;
      if (updates.class !== undefined) payload.class = updates.class || null;
      if (updates.year !== undefined) payload.year = updates.year || null;
      if (updates.make !== undefined) payload.make = updates.make || null;
      if (updates.model !== undefined) payload.model = updates.model || null;
      if (updates.color !== undefined) payload.color = updates.color || null;
      if (updates.isActive !== undefined) payload.is_active = updates.isActive;
      if (updates.notes !== undefined) payload.notes = updates.notes || null;

      const { error } = await supabase.from('race_cars').update(payload).eq('id', id);
      if (error) {
        console.error('[CarContext] Update error:', error.message, error.details, error.hint);
        throw error;
      }
      toast.success('Car updated');
      return { success: true };
    } catch (err: any) {
      console.error('[CarContext] Error updating car:', err);
      // Rollback
      setCars(prevCars);
      
      let errorMsg = 'Failed to update car.';
      if (err?.message) errorMsg += ` ${err.message}`;
      toast.error(errorMsg, { duration: 6000 });
      return { success: false, error: errorMsg };
    }
  }, [cars, isDemoMode]);

  const deleteCar = useCallback(async (id: string): Promise<CarMutationResult> => {
    const prevCars = [...cars];
    setCars(prev => prev.filter(c => c.id !== id));
    
    // If the deleted car was selected, reset to All Cars
    if (selectedCarId === id) {
      setSelectedCarId(null);
    }

    if (isDemoMode) {
      try {
        localStorage.setItem('demo_race_cars', JSON.stringify(prevCars.filter(c => c.id !== id)));
      } catch {}
      toast.success('Car removed');
      return { success: true };
    }

    try {
      const { error } = await supabase.from('race_cars').delete().eq('id', id);
      if (error) {
        console.error('[CarContext] Delete error:', error.message, error.details, error.hint);
        throw error;
      }
      toast.success('Car removed');
      return { success: true };
    } catch (err: any) {
      console.error('[CarContext] Error deleting car:', err);
      setCars(prevCars);
      
      let errorMsg = 'Failed to remove car.';
      if (err?.message) errorMsg += ` ${err.message}`;
      toast.error(errorMsg, { duration: 6000 });
      return { success: false, error: errorMsg };
    }
  }, [cars, selectedCarId, isDemoMode, setSelectedCarId]);

  const getCarById = useCallback((id: string) => {
    return cars.find(c => c.id === id);
  }, [cars]);

  const getCarLabel = useCallback((id: string | null) => {
    if (!id) return 'All Cars';
    const car = cars.find(c => c.id === id);
    if (!car) return 'Unknown Car';
    const parts = [car.carNumber ? `#${car.carNumber}` : '', car.nickname || '', car.year || '', car.make, car.model].filter(Boolean);
    return parts.join(' ') || 'Unnamed Car';
  }, [cars]);

  const activeCars = cars.filter(c => c.isActive);

  return (
    <CarContext.Provider value={{
      cars,
      selectedCarId,
      isLoading,
      addCar,
      updateCar,
      deleteCar,
      setSelectedCarId,
      getCarById,
      getCarLabel,
      activeCars,
      refreshCars,
    }}>
      {children}
    </CarContext.Provider>
  );
};

export const useCar = () => {
  const context = useContext(CarContext);
  if (!context) {
    throw new Error('useCar must be used within CarProvider');
  }
  return context;
};
