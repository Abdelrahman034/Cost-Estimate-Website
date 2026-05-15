import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileImage, CheckCircle, AlertCircle, Send, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { drawingsApi, emailsApi } from '../../services/api';

export default function DrawingAnalyzer({ projectInfo }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [rfq, setRfq] = useState(null);
  const [rfqLoading, setRfqLoading] = useState(false);
  const [supplierEmails, setSupplierEmails] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const onDrop = useCallback((accepted) => {
    if (accepted.length === 0) return;
    const f = accepted[0];
    setFile(f);
    setResult(null);
    setRfq(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
  });

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await drawingsApi.analyze(file);
      setResult(res.data.data);
      toast.success('Drawing analyzed successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const generateRFQ = async () => {
    if (!result?.units?.length) {
      toast.error('No units found in drawing');
      return;
    }
    setRfqLoading(true);
    try {
      const res = await emailsApi.generateRFQ(result.units, {
        projectName: projectInfo.projectName || 'HVAC Project',
        location: projectInfo.location,
        bidDate: projectInfo.bidDate,
        companyName: projectInfo.companyName,
      });
      setRfq(res.data.rfq);
      toast.success('RFQ email generated!');
    } catch (err) {
      toast.error('Could not generate RFQ');
    } finally {
      setRfqLoading(false);
    }
  };

  const sendRFQ = async () => {
    if (!rfq || !supplierEmails.trim()) {
      toast.error('Enter supplier email addresses first');
      return;
    }
    setSendingEmail(true);
    try {
      const emails = supplierEmails.split(',').map((e) => ({ email: e.trim() }));
      await emailsApi.sendRFQ(result.units, {
        projectName: projectInfo.projectName || 'HVAC Project',
        location: projectInfo.location,
        bidDate: projectInfo.bidDate,
        companyName: projectInfo.companyName,
      }, emails);
      toast.success(`RFQ sent to ${emails.length} supplier(s)!`);
      setSupplierEmails('');
    } catch (err) {
      toast.error('Failed to send email. Check your email settings in .env');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Drawing Analyzer</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a mechanical drawing and Claude AI will extract duct sizes, lengths, and unit schedules
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            {preview ? (
              <img src={preview} alt="Drawing preview" className="max-h-64 mx-auto rounded-lg object-contain" />
            ) : (
              <div>
                <Upload size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="font-medium text-gray-600">
                  {isDragActive ? 'Drop the drawing here' : 'Drag & drop a drawing here'}
                </p>
                <p className="text-sm text-gray-400 mt-1">or click to browse — JPG, PNG, WEBP (max 20MB)</p>
              </div>
            )}
          </div>

          {file && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
              <FileImage size={16} className="text-blue-500" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          )}

          <button
            onClick={analyze}
            disabled={!file || loading}
            className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Analyzing with Claude AI...
              </>
            ) : (
              <>
                <FileImage size={16} />
                Analyze Drawing
              </>
            )}
          </button>
        </div>

        {/* Results */}
        <div>
          {!result && !loading && (
            <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <div>
                <CheckCircle size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm">Extraction results will appear here</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="h-full flex items-center justify-center bg-blue-50 rounded-xl p-8 text-center">
              <div>
                <div className="w-12 h-12 spinner mx-auto mb-4" />
                <p className="font-medium text-blue-700">Claude is analyzing your drawing...</p>
                <p className="text-sm text-blue-500 mt-1">This may take 15–30 seconds</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Ducts */}
              {result.ducts?.length > 0 && (
                <div className="card">
                  <h3 className="section-title text-sm">
                    Duct Segments ({result.ducts.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Size</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Type</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-gray-600">LF</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.ducts.map((d, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-2 py-1.5 font-mono font-semibold">{d.size}</td>
                            <td className="px-2 py-1.5 capitalize">{d.type}</td>
                            <td className="px-2 py-1.5">{d.linearFeet ?? '—'}</td>
                            <td className="px-2 py-1.5 text-gray-500">{d.location || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Units */}
              {result.units?.length > 0 && (
                <div className="card">
                  <h3 className="section-title text-sm">
                    Unit Schedule ({result.units.length} units)
                  </h3>
                  <div className="space-y-2">
                    {result.units.map((u, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-bold text-blue-600 text-xs w-16">{u.tag}</span>
                        <span className="text-xs flex-1">{u.type}</span>
                        {u.cfm && <span className="text-xs text-gray-500">{u.cfm} CFM</span>}
                        {u.tons && <span className="text-xs text-gray-500">{u.tons} tons</span>}
                      </div>
                    ))}
                  </div>

                  {/* RFQ Generation */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={generateRFQ}
                      disabled={rfqLoading}
                      className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                    >
                      {rfqLoading ? (
                        <><Loader size={14} className="animate-spin" /> Generating RFQ...</>
                      ) : (
                        'Generate Supplier RFQ Email'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Summary */}
              {result.summary && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-green-800">
                      <strong>Scale:</strong> {result.summary.drawingScale || 'Unknown'} ·{' '}
                      <strong>Total LF:</strong> {result.summary.totalDuctLinearFeet || '?'} ·{' '}
                      <strong>Sq Ft:</strong> {result.summary.totalDuctSqFt || '?'}
                      {result.summary.notes && <p className="mt-1 text-green-700">{result.summary.notes}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RFQ Panel */}
      {rfq && (
        <div className="mt-6 card">
          <h3 className="section-title">Generated RFQ Email</h3>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="text-xs text-gray-500 mb-1 font-medium">Subject:</div>
            <div className="text-sm font-medium text-gray-900 mb-3">{rfq.subject}</div>
            <div className="text-xs text-gray-500 mb-1 font-medium">Body:</div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
              {rfq.body}
            </pre>
          </div>
          <div className="flex items-center gap-3">
            <input
              className="input flex-1"
              placeholder="supplier1@company.com, supplier2@company.com"
              value={supplierEmails}
              onChange={(e) => setSupplierEmails(e.target.value)}
            />
            <button
              onClick={sendRFQ}
              disabled={sendingEmail || !supplierEmails.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {sendingEmail ? (
                <><Loader size={14} className="animate-spin" /> Sending...</>
              ) : (
                <><Send size={14} /> Send RFQ</>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Separate multiple emails with commas</p>
        </div>
      )}
    </div>
  );
}
