import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Database,
  Upload,
  HardDrive,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  X,
  Zap,
  Wrench,
  CircleDot,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ServerCrash,
  Sparkles
} from 'lucide-react';

interface StorageSetupGuideProps {
  onDismiss?: () => void;
  compact?: boolean;
}

type TestStatus = 'idle' | 'testing' | 'pass' | 'fail' | 'partial';

interface TestResult {
  bucketExists: boolean;
  canUpload: boolean;
  canRead: boolean;
  canDelete: boolean;
  error?: string;
  details?: string;
}

type AutoFixStatus = 'idle' | 'running' | 'success' | 'partial' | 'failed';

interface AutoFixStepResult {
  step: string;
  status: 'success' | 'error' | 'skipped';
  message: string;
  details?: any;
}

interface AutoFixResponse {
  success: boolean;
  autoFixApplied?: boolean;
  policiesExist?: {
    insert: boolean;
    select: boolean;
    update: boolean;
    delete: boolean;
    all: boolean;
  };
  existingPolicies?: string[];
  uploadWorks?: boolean;
  results: AutoFixStepResult[];
  message: string;
  manualSqlRequired?: boolean;
  sql?: string;
  error?: string;
  hint?: string;
  timestamp?: string;
}

const SQL_POLICIES = `-- ============================================
-- Storage RLS Policies for 'media' bucket
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Create the media bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('media', 'media', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- 2. DROP any existing policies (safe to re-run)
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow owner updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow owner deletes" ON storage.objects;
DROP POLICY IF EXISTS "media_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "media_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "media_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "media_delete_policy" ON storage.objects;

-- 3. Enable RLS on storage.objects (may already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. INSERT policy: authenticated users can upload to 'media'
CREATE POLICY "media_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

-- 5. SELECT policy: anyone can read from 'media' (public bucket)
CREATE POLICY "media_select_policy"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

-- 6. UPDATE policy: authenticated users can update their own files
CREATE POLICY "media_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media' AND auth.uid()::text = owner_id::text)
WITH CHECK (bucket_id = 'media');

-- 7. DELETE policy: authenticated users can delete their own files
CREATE POLICY "media_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND auth.uid()::text = owner_id::text);`;

const SQL_MANUAL_STEPS = [
  {
    title: 'Go to Supabase Dashboard',
    description: 'Open your Supabase project dashboard and navigate to Storage > Policies',
    icon: ExternalLink
  },
  {
    title: 'Create INSERT Policy',
    description: 'Policy name: "media_insert_policy" | Operation: INSERT | Target roles: authenticated | WITH CHECK: bucket_id = \'media\'',
    icon: Upload
  },
  {
    title: 'Create SELECT Policy',
    description: 'Policy name: "media_select_policy" | Operation: SELECT | Target roles: public | USING: bucket_id = \'media\'',
    icon: Shield
  },
  {
    title: 'Create UPDATE Policy',
    description: 'Policy name: "media_update_policy" | Operation: UPDATE | Target roles: authenticated | USING: bucket_id = \'media\' AND auth.uid()::text = owner_id::text',
    icon: Shield
  },
  {
    title: 'Create DELETE Policy',
    description: 'Policy name: "media_delete_policy" | Operation: DELETE | Target roles: authenticated | USING: bucket_id = \'media\' AND auth.uid()::text = owner_id::text',
    icon: Shield
  }
];

const STEP_LABELS: Record<string, string> = {
  bucket: 'Media Bucket',
  check_policies: 'Policy Check',
  auto_fix: 'Auto-Fix Policies',
  auto_fix_rpc: 'RPC Auto-Fix',
  upload_test: 'Upload Verification',
  enable_rls: 'Enable RLS',
  drop_old_policies: 'Clean Old Policies',
  insert_policy: 'INSERT Policy',
  select_policy: 'SELECT Policy',
  update_policy: 'UPDATE Policy',
  delete_policy: 'DELETE Policy',
};

const StorageSetupGuide: React.FC<StorageSetupGuideProps> = ({ onDismiss, compact = false }) => {
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [showSQL, setShowSQL] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [isRetesting, setIsRetesting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-fix state
  const [autoFixStatus, setAutoFixStatus] = useState<AutoFixStatus>('idle');
  const [autoFixResponse, setAutoFixResponse] = useState<AutoFixResponse | null>(null);
  const [autoFixProgress, setAutoFixProgress] = useState(0);
  const [showAutoFixDetails, setShowAutoFixDetails] = useState(false);

  // Auto-test on mount
  useEffect(() => {
    runStorageTest();
  }, []);

  const runStorageTest = async () => {
    setTestStatus('testing');
    setIsRetesting(true);
    const result: TestResult = {
      bucketExists: false,
      canUpload: false,
      canRead: false,
      canDelete: false
    };

    try {
      // Test 1: Check if bucket exists by listing
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      if (bucketError) {
        result.error = 'Cannot list storage buckets: ' + bucketError.message;
        result.details = 'This may indicate a permissions issue or Supabase configuration problem.';
        setTestResult(result);
        setTestStatus('fail');
        setIsRetesting(false);
        return;
      }

      result.bucketExists = buckets?.some(b => b.id === 'media') || false;
      if (!result.bucketExists) {
        result.error = 'Media bucket does not exist';
        result.details = 'The "media" storage bucket needs to be created. Run the SQL migration below.';
        setTestResult(result);
        setTestStatus('fail');
        setIsRetesting(false);
        return;
      }

      // Test 2: Try uploading a tiny test file
      const testFileName = `_storage_test_${Date.now()}.txt`;
      const testBlob = new Blob(['storage-policy-test'], { type: 'text/plain' });

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(testFileName, testBlob, {
          cacheControl: '0',
          upsert: true
        });

      if (uploadError) {
        result.error = 'Upload test failed: ' + uploadError.message;
        if (uploadError.message.includes('row-level security') || uploadError.message.includes('policy') || uploadError.message.includes('security')) {
          result.details = 'The storage.objects table has no RLS policies allowing uploads. You need to create INSERT, SELECT, UPDATE, and DELETE policies for the media bucket.';
        } else if (uploadError.message.includes('Bucket not found')) {
          result.details = 'The media bucket was not found. It may have been deleted.';
          result.bucketExists = false;
        } else {
          result.details = 'An unexpected error occurred during the upload test.';
        }
        setTestResult(result);
        setTestStatus('fail');
        setIsRetesting(false);
        return;
      }

      result.canUpload = true;

      // Test 3: Try reading the file
      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(testFileName);

      if (urlData?.publicUrl) {
        result.canRead = true;
      }

      // Test 4: Try deleting the test file
      const { error: deleteError } = await supabase.storage
        .from('media')
        .remove([testFileName]);

      if (!deleteError) {
        result.canDelete = true;
      }

      // Determine overall status
      if (result.canUpload && result.canRead && result.canDelete) {
        setTestStatus('pass');
      } else if (result.canUpload) {
        setTestStatus('partial');
        result.details = 'Upload works but some operations may be restricted.';
      } else {
        setTestStatus('fail');
      }
    } catch (err: any) {
      result.error = err.message || 'Unexpected error during storage test';
      result.details = 'Check the browser console for more details.';
      setTestStatus('fail');
    }

    setTestResult(result);
    setIsRetesting(false);
  };

  const handleAutoFix = useCallback(async () => {
    setAutoFixStatus('running');
    setAutoFixResponse(null);
    setAutoFixProgress(0);
    setShowAutoFixDetails(true);

    // Simulate progress steps while waiting for the edge function
    const progressInterval = setInterval(() => {
      setAutoFixProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + Math.random() * 15;
      });
    }, 400);

    try {
      const { data, error } = await supabase.functions.invoke('fix-storage-policies', {
        body: {}
      });

      clearInterval(progressInterval);
      setAutoFixProgress(100);

      if (error) {
        setAutoFixStatus('failed');
        setAutoFixResponse({
          success: false,
          results: [],
          message: `Edge function error: ${error.message}`,
          error: error.message
        });
        return;
      }

      const response = data as AutoFixResponse;
      setAutoFixResponse(response);

      if (response.success) {
        setAutoFixStatus('success');
      } else if (response.manualSqlRequired) {
        setAutoFixStatus('partial');
        // Auto-expand the SQL section since manual intervention is needed
        setShowSQL(true);
      } else if (response.error) {
        setAutoFixStatus('failed');
      } else {
        setAutoFixStatus('partial');
      }

      // Auto re-test storage after a brief delay
      setTimeout(() => {
        runStorageTest();
      }, 1500);

    } catch (err: any) {
      clearInterval(progressInterval);
      setAutoFixProgress(100);
      setAutoFixStatus('failed');
      setAutoFixResponse({
        success: false,
        results: [],
        message: `Request failed: ${err.message}`,
        error: err.message,
        hint: 'Check your network connection and try again.'
      });
    }
  }, []);

  const handleCopySQL = async (sqlText?: string) => {
    const textToCopy = sqlText || SQL_POLICIES;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedSQL(true);
      setTimeout(() => setCopiedSQL(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedSQL(true);
      setTimeout(() => setCopiedSQL(false), 3000);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'error': return <X className="w-4 h-4 text-red-400" />;
      case 'skipped': return <ArrowRight className="w-4 h-4 text-slate-500" />;
      default: return <CircleDot className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStepBg = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500/10 border-green-500/20';
      case 'error': return 'bg-red-500/10 border-red-500/20';
      case 'skipped': return 'bg-slate-700/30 border-slate-600/20';
      default: return 'bg-slate-800/50 border-slate-700/30';
    }
  };

  // If storage is working and user dismissed, hide
  if (dismissed && testStatus === 'pass') return null;

  // If storage is working, show minimal success indicator
  if (testStatus === 'pass' && compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
        <CheckCircle2 className="w-4 h-4 text-green-400" />
        <span className="text-sm text-green-300">Storage policies configured correctly</span>
      </div>
    );
  }

  if (testStatus === 'pass') {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-green-300 font-semibold">Storage Policies Configured</h4>
              <p className="text-green-300/70 text-sm mt-1">
                All 4 storage policies are working correctly. File uploads to the media bucket will work for Dashboard photos, Media Gallery, and Invoice uploads.
              </p>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Bucket exists
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Upload (INSERT)
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Read (SELECT)
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Delete (DELETE)
                </div>
              </div>
              {autoFixStatus === 'success' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-400/80">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Policies were configured automatically</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runStorageTest}
              disabled={isRetesting}
              className="text-green-400/50 hover:text-green-300 p-1.5 rounded-lg hover:bg-green-500/10 transition-colors"
              title="Re-test storage"
            >
              <RefreshCw className={`w-4 h-4 ${isRetesting ? 'animate-spin' : ''}`} />
            </button>
            {onDismiss && (
              <button onClick={handleDismiss} className="text-green-400/50 hover:text-green-300 p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={`rounded-xl border p-5 ${
        testStatus === 'testing' ? 'bg-blue-500/10 border-blue-500/30' :
        testStatus === 'fail' ? 'bg-red-500/10 border-red-500/30' :
        testStatus === 'partial' ? 'bg-yellow-500/10 border-yellow-500/30' :
        'bg-slate-800/50 border-slate-700/50'
      }`}>
        <div className="flex items-start gap-3">
          {testStatus === 'testing' ? (
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
          ) : testStatus === 'fail' ? (
            <ShieldAlert className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          ) : testStatus === 'partial' ? (
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
          ) : (
            <HardDrive className="w-6 h-6 text-slate-400 flex-shrink-0 mt-0.5" />
          )}

          <div className="flex-1">
            <h4 className={`font-semibold ${
              testStatus === 'testing' ? 'text-blue-300' :
              testStatus === 'fail' ? 'text-red-300' :
              testStatus === 'partial' ? 'text-yellow-300' :
              'text-white'
            }`}>
              {testStatus === 'testing' ? 'Testing Storage Policies...' :
               testStatus === 'fail' ? 'Storage Policies Missing' :
               testStatus === 'partial' ? 'Storage Partially Configured' :
               'Storage Policy Check'}
            </h4>

            {testResult?.error && (
              <p className="text-sm text-red-300/80 mt-1">{testResult.error}</p>
            )}
            {testResult?.details && (
              <p className="text-sm text-slate-400 mt-1">{testResult.details}</p>
            )}

            {/* Test Results Grid */}
            {testResult && testStatus !== 'testing' && (
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className={`flex items-center gap-1.5 text-xs ${testResult.bucketExists ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.bucketExists ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  Bucket exists
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${testResult.canUpload ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.canUpload ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  INSERT policy
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${testResult.canRead ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.canRead ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  SELECT policy
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${testResult.canDelete ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.canDelete ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  DELETE policy
                </div>
              </div>
            )}

            {/* Re-test button */}
            {testStatus !== 'testing' && (
              <button
                onClick={runStorageTest}
                disabled={isRetesting}
                className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetesting ? 'animate-spin' : ''}`} />
                Re-test Storage
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fix Instructions (only shown when there's a problem) */}
      {(testStatus === 'fail' || testStatus === 'partial') && (
        <>
          {/* AUTO-FIX BUTTON - Primary action */}
          <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-yellow-500/10 rounded-xl border border-orange-500/30 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20">
                  <Wrench className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-white font-bold text-lg">Automatic Fix</h4>
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs font-semibold uppercase tracking-wide">
                      Recommended
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Automatically create all 4 required storage policies using the server-side edge function. 
                    This runs with elevated privileges and will configure INSERT, SELECT, UPDATE, and DELETE policies on the media bucket.
                  </p>

                  {/* Auto-Fix Button */}
                  {autoFixStatus === 'idle' && (
                    <button
                      onClick={handleAutoFix}
                      className="mt-4 flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold rounded-lg shadow-lg shadow-orange-500/25 transition-all duration-200 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Zap className="w-5 h-5" />
                      Auto-Fix Storage Policies
                    </button>
                  )}

                  {/* Running State */}
                  {autoFixStatus === 'running' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                        <span className="text-orange-300 font-medium">Configuring storage policies...</span>
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min(autoFixProgress, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Running edge function: fix-storage-policies</span>
                        <span>{Math.round(autoFixProgress)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Success State */}
                  {autoFixStatus === 'success' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2.5 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <div>
                          <p className="text-green-300 font-medium text-sm">{autoFixResponse?.message || 'Policies created successfully!'}</p>
                          <p className="text-green-300/60 text-xs mt-0.5">Storage test will re-run automatically...</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Partial / Failed State */}
                  {(autoFixStatus === 'partial' || autoFixStatus === 'failed') && (
                    <div className="mt-4 space-y-3">
                      <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                        autoFixStatus === 'failed' 
                          ? 'bg-red-500/10 border-red-500/30' 
                          : 'bg-yellow-500/10 border-yellow-500/30'
                      }`}>
                        {autoFixStatus === 'failed' ? (
                          <ServerCrash className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className={`font-medium text-sm ${autoFixStatus === 'failed' ? 'text-red-300' : 'text-yellow-300'}`}>
                            {autoFixResponse?.message || (autoFixStatus === 'failed' ? 'Auto-fix failed' : 'Partial fix applied')}
                          </p>
                          {autoFixResponse?.hint && (
                            <p className="text-slate-400 text-xs mt-1">{autoFixResponse.hint}</p>
                          )}
                          {autoFixResponse?.manualSqlRequired && (
                            <p className="text-yellow-300/70 text-xs mt-1">
                              Manual SQL execution is required. Use the SQL Editor section below.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Retry button */}
                      <button
                        onClick={handleAutoFix}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry Auto-Fix
                      </button>
                    </div>
                  )}

                  {/* Step-by-step results (expandable) */}
                  {autoFixResponse?.results && autoFixResponse.results.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowAutoFixDetails(!showAutoFixDetails)}
                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
                      >
                        {showAutoFixDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {showAutoFixDetails ? 'Hide' : 'Show'} detailed results ({autoFixResponse.results.length} steps)
                      </button>

                      {showAutoFixDetails && (
                        <div className="mt-3 space-y-1.5">
                          {autoFixResponse.results.map((step, idx) => (
                            <div
                              key={idx}
                              className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${getStepBg(step.status)}`}
                            >
                              <div className="mt-0.5 flex-shrink-0">
                                {getStepIcon(step.status)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-300">
                                    {STEP_LABELS[step.step] || step.step}
                                  </span>
                                  <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                    step.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                    step.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                    'bg-slate-600/50 text-slate-500'
                                  }`}>
                                    {step.status}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 break-words">{step.message}</p>
                              </div>
                            </div>
                          ))}

                          {/* Policy existence summary */}
                          {autoFixResponse.policiesExist && (
                            <div className="mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                              <p className="text-xs font-semibold text-slate-400 mb-2">Policy Status Summary</p>
                              <div className="grid grid-cols-2 gap-2">
                                {(['insert', 'select', 'update', 'delete'] as const).map(policy => (
                                  <div key={policy} className="flex items-center gap-1.5 text-xs">
                                    {autoFixResponse.policiesExist![policy] ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                    ) : (
                                      <X className="w-3.5 h-3.5 text-red-400" />
                                    )}
                                    <span className={autoFixResponse.policiesExist![policy] ? 'text-green-400' : 'text-red-400'}>
                                      {policy.toUpperCase()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Existing policies list */}
                          {autoFixResponse.existingPolicies && autoFixResponse.existingPolicies.length > 0 && (
                            <div className="mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                              <p className="text-xs font-semibold text-slate-400 mb-1.5">Detected Policies on storage.objects</p>
                              <div className="flex flex-wrap gap-1.5">
                                {autoFixResponse.existingPolicies.map((name, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs font-mono">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {autoFixResponse.timestamp && (
                            <p className="text-[10px] text-slate-600 mt-2">
                              Completed at {new Date(autoFixResponse.timestamp).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SQL from auto-fix response (if manual SQL required) */}
          {autoFixResponse?.manualSqlRequired && autoFixResponse?.sql && (
            <div className="bg-yellow-500/5 rounded-xl border border-yellow-500/30 overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-300 font-semibold">Required SQL (from auto-fix)</span>
                  </div>
                  <button
                    onClick={() => handleCopySQL(autoFixResponse.sql)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      copiedSQL
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                    }`}
                  >
                    {copiedSQL ? (
                      <><Check className="w-4 h-4" /> Copied!</>
                    ) : (
                      <><Copy className="w-4 h-4" /> Copy SQL</>
                    )}
                  </button>
                </div>
                <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                  <pre className="p-4 text-xs text-green-300 overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed">
                    {autoFixResponse.sql}
                  </pre>
                </div>
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-300/80">
                      Paste this SQL into <strong>Supabase Dashboard &gt; SQL Editor</strong> and click <strong>Run</strong>, then click <strong>Re-test Storage</strong> above.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Fix: SQL Editor (collapsible) */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <button
              onClick={() => setShowSQL(!showSQL)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <h4 className="text-white font-semibold">Manual Fix: SQL Editor</h4>
                  <p className="text-sm text-slate-400">Copy and paste the full SQL migration into Supabase SQL Editor</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-slate-600/50 text-slate-400 rounded text-xs font-medium">Fallback</span>
                {showSQL ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </div>
            </button>

            {showSQL && (
              <div className="border-t border-slate-700/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-300 font-medium">Complete Storage Policy SQL</span>
                  </div>
                  <button
                    onClick={() => handleCopySQL()}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      copiedSQL
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                    }`}
                  >
                    {copiedSQL ? (
                      <><Check className="w-4 h-4" /> Copied!</>
                    ) : (
                      <><Copy className="w-4 h-4" /> Copy SQL</>
                    )}
                  </button>
                </div>

                <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                  <pre className="p-4 text-xs text-green-300 overflow-x-auto max-h-80 overflow-y-auto font-mono leading-relaxed">
                    {SQL_POLICIES}
                  </pre>
                </div>

                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-300">
                      <p className="font-medium mb-1">How to run this:</p>
                      <ol className="list-decimal list-inside space-y-1 text-blue-300/80">
                        <li>Open your Supabase project dashboard</li>
                        <li>Go to <strong>SQL Editor</strong> (left sidebar)</li>
                        <li>Click <strong>New Query</strong></li>
                        <li>Paste the SQL above</li>
                        <li>Click <strong>Run</strong></li>
                        <li>Come back here and click <strong>Re-test Storage</strong></li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Alternative: Manual Dashboard Steps */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <button
              onClick={() => setShowManualSteps(!showManualSteps)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-600/50 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-left">
                  <h4 className="text-white font-semibold">Alternative: Manual Dashboard Setup</h4>
                  <p className="text-sm text-slate-400">Create policies one-by-one via Supabase Storage UI</p>
                </div>
              </div>
              {showManualSteps ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>

            {showManualSteps && (
              <div className="border-t border-slate-700/50 p-4">
                <div className="space-y-4">
                  {SQL_MANUAL_STEPS.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-orange-400">
                          {index + 1}
                        </div>
                        <div>
                          <h5 className="text-white font-medium text-sm">{step.title}</h5>
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-300/80">
                      The SQL Editor method above is faster and creates all 4 policies at once. Use the manual method only if the SQL Editor approach doesn't work.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fallback Info */}
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-500">
                <p className="font-medium text-slate-400 mb-1">Fallback Mode</p>
                <p>
                  While storage policies are missing, the app uses a fallback mechanism: uploads are attempted via the edge function (server-side), 
                  and if that also fails, images are saved as data URLs in localStorage. This means photos will work but won't persist across devices 
                  until storage policies are configured.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StorageSetupGuide;
