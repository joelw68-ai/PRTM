-- ============================================================
-- PRO MOD LOGBOOK — COMPREHENSIVE SCHEMA DIAGNOSTIC CHECK
-- ============================================================
-- Run this in the Supabase SQL Editor to verify every table,
-- column, and RLS policy matches what the app expects.
--
-- Outputs a clear PASS/WARN/FAIL report for each table.
-- ============================================================

DO $$
DECLARE
  _table_name TEXT;
  _cols TEXT[];
  _col TEXT;
  _exists BOOLEAN;
  _rls_enabled BOOLEAN;
  _missing_cols TEXT[];
  _extra_cols TEXT[];
  _actual_cols TEXT[];
  _status TEXT;
  _total_tables INT := 0;
  _pass_count INT := 0;
  _warn_count INT := 0;
  _fail_count INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║   PRO MOD LOGBOOK — SCHEMA DIAGNOSTIC REPORT               ║';
  RAISE NOTICE '║   Generated: %                              ║', TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS');
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- ============================================================
  -- 1. user_profiles
  -- ============================================================
  _table_name := 'user_profiles';
  _cols := ARRAY['id','user_id','team_name','driver_name','driver_license_number','driver_license_class','car_name','car_number','car_class','car_make','car_model','car_year','car_weight','engine_type','fuel_type','home_track','team_logo_url','contact_email','contact_phone','notes','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN
    RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name;
    _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN
      RAISE NOTICE '[FAIL] % — Missing columns: %', _table_name, array_to_string(_missing_cols, ', ');
      _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN
      RAISE NOTICE '[WARN] % — RLS is DISABLED', _table_name;
      _warn_count := _warn_count + 1;
    ELSE
      RAISE NOTICE '[PASS] % — All % columns present, RLS enabled', _table_name, array_length(_cols, 1);
      _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- ============================================================
  -- 2. engines
  -- ============================================================
  _table_name := 'engines';
  _cols := ARRAY['id','user_id','name','serial_number','builder','displacement','install_date','total_passes','passes_since_rebuild','status','currently_installed','notes','components','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN
    RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name;
    _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN
      RAISE NOTICE '[FAIL] % — Missing columns: %', _table_name, array_to_string(_missing_cols, ', ');
      _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN
      RAISE NOTICE '[WARN] % — RLS is DISABLED', _table_name;
      _warn_count := _warn_count + 1;
    ELSE
      RAISE NOTICE '[PASS] % — All % columns present, RLS enabled', _table_name, array_length(_cols, 1);
      _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- ============================================================
  -- 3. superchargers
  -- ============================================================
  _table_name := 'superchargers';
  _cols := ARRAY['id','user_id','name','serial_number','model','install_date','total_passes','passes_since_service','status','currently_installed','notes','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 4. cylinder_heads
  _table_name := 'cylinder_heads';
  _cols := ARRAY['id','user_id','name','serial_number','builder','install_date','total_passes','passes_since_refresh','status','position','engine_id','notes','components','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 5. pass_logs
  _table_name := 'pass_logs';
  _cols := ARRAY['id','user_id','date','time','track','location','session_type','round','lane','result','reaction_time','sixty_foot','three_thirty','eighth','mph','weather','sae_correction','density_altitude','corrected_hp','engine_id','supercharger_id','tire_pressure_front','tire_pressure_rear_left','tire_pressure_rear_right','wheelie_bar_setting','launch_rpm','boost_setting','notes','crew_chief','aborted','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 6. maintenance_items
  _table_name := 'maintenance_items';
  _cols := ARRAY['id','user_id','component','category','pass_interval','current_passes','last_service','next_service_passes','status','priority','notes','estimated_cost','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 7. sfi_certifications
  _table_name := 'sfi_certifications';
  _cols := ARRAY['id','user_id','item','sfi_spec','certification_date','expiration_date','vendor','serial_number','status','days_until_expiration','notes','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 8. work_orders
  _table_name := 'work_orders';
  _cols := ARRAY['id','user_id','title','description','category','priority','status','created_date','due_date','completed_date','assigned_to','estimated_hours','actual_hours','parts','related_component','notes','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 9. engine_swap_logs
  _table_name := 'engine_swap_logs';
  _cols := ARRAY['id','user_id','date','time','previous_engine_id','new_engine_id','reason','performed_by','notes','created_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 10. checklists
  _table_name := 'checklists';
  _cols := ARRAY['id','user_id','checklist_type','task','category','completed','notes','critical','checked_by','checked_at','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 11. parts_inventory
  _table_name := 'parts_inventory';
  _cols := ARRAY['id','user_id','part_number','description','category','subcategory','on_hand','min_quantity','max_quantity','vendor','vendor_part_number','unit_cost','total_value','last_ordered','last_used','location','notes','status','reorder_status','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 12. track_weather_history
  _table_name := 'track_weather_history';
  _cols := ARRAY['id','user_id','track_id','track_name','location','elevation','visits','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 13. race_events
  _table_name := 'race_events';
  _cols := ARRAY['id','user_id','title','event_type','track_name','track_location','start_date','end_date','start_time','end_time','status','sanctioning_body','entry_fee','purse','notes','result','best_et','best_mph','rounds_won','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 14. team_members
  _table_name := 'team_members';
  _cols := ARRAY['id','user_id','name','email','phone','role','permissions','specialties','is_active','joined_date','emergency_contact_name','emergency_contact_phone','notes','avatar_url','hourly_rate','daily_rate','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 15. media_gallery
  _table_name := 'media_gallery';
  _cols := ARRAY['id','user_id','title','description','media_type','url','thumbnail_url','category','tags','event_name','event_date','uploaded_by','file_size','duration','width','height','is_featured','is_public','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 16. saved_tracks
  _table_name := 'saved_tracks';
  _cols := ARRAY['id','user_id','name','location','address','city','state','zip','elevation','track_length','surface_type','notes','is_favorite','last_visited','visit_count','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 17. audit_logs
  _table_name := 'audit_logs';
  _cols := ARRAY['id','timestamp','user_id','user_name','user_role','action_type','category','entity_type','entity_id','entity_name','description','before_value','after_value','metadata'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 18. beta_feedback
  _table_name := 'beta_feedback';
  _cols := ARRAY['id','user_id','category','description','status','created_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 19. chassis_setups
  _table_name := 'chassis_setups';
  _cols := ARRAY['id','user_id','name','description','race_event','race_date','track_name','track_conditions','weather_conditions','upper_bar_chassis_x','upper_bar_chassis_y','upper_bar_rear_x','upper_bar_rear_y','lower_bar_chassis_x','lower_bar_chassis_y','lower_bar_rear_x','lower_bar_rear_y','rear_end_center_height','instant_center_length','instant_center_height','anti_squat_percentage','corner_weights','ballast_items','total_weight','cross_weight_percentage','shock_settings','ride_heights','spring_data','cg_data','pinion_data','performance_notes','sixty_foot_time','eighth_mile_et','eighth_mile_mph','quarter_mile_et','quarter_mile_mph','is_favorite','tags','created_by','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 20. transmissions
  _table_name := 'transmissions';
  _cols := ARRAY['id','user_id','name','serial_number','type','model','builder','gear_count','install_date','total_passes','status','currently_installed','notes','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 21. setup_vendors
  _table_name := 'setup_vendors';
  _cols := ARRAY['id','user_id','name','code','contact_name','email','phone','address','city','state','zip','website','category','payment_terms','notes','rating','discount_percent','lead_time_days','minimum_order','shipping_method','is_active','created_date','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 22. vendor_invoices
  _table_name := 'vendor_invoices';
  _cols := ARRAY['id','user_id','vendor_id','vendor_name','invoice_number','invoice_date','due_date','amount','tax','total','status','po_number','file_url','file_name','file_type','file_size','notes','category','payment_method','payment_date','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 23. todo_items
  _table_name := 'todo_items';
  _cols := ARRAY['id','user_id','title','description','priority','status','category','assigned_to','created_by','created_by_role','due_date','completed_date','completed_by','tags','is_archived','archived_at','archived_by','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 24. user_settings
  _table_name := 'user_settings';
  _cols := ARRAY['id','user_id','feature','settings','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 25. team_notes
  _table_name := 'team_notes';
  _cols := ARRAY['id','user_id','title','content','category','created_by','is_pinned','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 26. labor_entries
  _table_name := 'labor_entries';
  _cols := ARRAY['id','user_id','team_member_id','team_member_name','date','hours','hourly_rate','daily_rate','rate_type','total_cost','description','category','notes','event_id','event_name','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 27. team_invites (NEW)
  _table_name := 'team_invites';
  _cols := ARRAY['id','team_owner_id','email','role','permissions','token','status','invited_by_name','team_name','created_at','expires_at','accepted_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 28. team_memberships (NEW)
  _table_name := 'team_memberships';
  _cols := ARRAY['id','team_owner_id','member_user_id','team_member_id','role','permissions','status','joined_at','invite_id','created_at','updated_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- 29. parts_usage_log (NEW)
  _table_name := 'parts_usage_log';
  _cols := ARRAY['id','user_id','part_id','part_number','part_description','quantity_used','unit_cost','total_cost','usage_date','usage_type','related_id','related_title','notes','recorded_by','previous_on_hand','new_on_hand','created_at'];
  _total_tables := _total_tables + 1;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table_name) INTO _exists;
  IF NOT _exists THEN RAISE NOTICE '[FAIL] % — TABLE DOES NOT EXIST', _table_name; _fail_count := _fail_count + 1;
  ELSE
    SELECT ARRAY_AGG(column_name::TEXT) INTO _actual_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=_table_name;
    _missing_cols := ARRAY(SELECT unnest(_cols) EXCEPT SELECT unnest(_actual_cols));
    SELECT relrowsecurity INTO _rls_enabled FROM pg_class WHERE relname=_table_name AND relnamespace='public'::regnamespace;
    IF array_length(_missing_cols, 1) > 0 THEN RAISE NOTICE '[FAIL] % — Missing: %', _table_name, array_to_string(_missing_cols, ', '); _fail_count := _fail_count + 1;
    ELSIF NOT _rls_enabled THEN RAISE NOTICE '[WARN] % — RLS DISABLED', _table_name; _warn_count := _warn_count + 1;
    ELSE RAISE NOTICE '[PASS] % — All % cols, RLS on', _table_name, array_length(_cols, 1); _pass_count := _pass_count + 1;
    END IF;
  END IF;

  -- ============================================================
  -- SUMMARY
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  SUMMARY: % tables checked', _total_tables;
  RAISE NOTICE '    PASS: %    WARN: %    FAIL: %', _pass_count, _warn_count, _fail_count;
  IF _fail_count = 0 AND _warn_count = 0 THEN
    RAISE NOTICE '  STATUS: ALL CLEAR — Schema matches app expectations';
  ELSIF _fail_count = 0 THEN
    RAISE NOTICE '  STATUS: WARNINGS — Check RLS policies on flagged tables';
  ELSE
    RAISE NOTICE '  STATUS: FAILURES — Run sql_migration_incremental.sql to fix';
  END IF;
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
