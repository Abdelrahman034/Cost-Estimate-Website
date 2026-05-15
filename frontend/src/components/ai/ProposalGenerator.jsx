import React, { useState } from 'react';
import { FileText, Download, Send, Loader, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { proposalsApi } from '../../services/api';

export default function ProposalGenerator({ projectInfo }) {
  const [estimate, setEstimate] = useState({
    material: '',
    labor: '',
    subcontractors: '',
    overhead: '',
    profit: '',
  });
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [result, setResult] = useState(null);

  const total = ['material', 'labor', 'subcontractors', 'overhead', 'profit']
    .reduce((sum, k) => sum + (parseFloat(estimate[k]) || 0), 0);

  const generate = async () => {
    if (!projectInfo.projectName) {
      toast.error('Please set the project name in the header first');
      return;
    }
    const estimateData = {
      material: parseFloat(estimate.material) || 0,
      labor: parseFloat(estimate.labor) || 0,
      subcontractors: parseFloat(estimate.subcontractors) || 0,
      overhead: parseFloat(estimate.overhead) || 0,
      profit: parseFloat(estimate.profit) || 0,
      total,
    };
    setLoading(true);
    try {
      const res = await proposalsApi.generate(estimateData, {
        ...projectInfo,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      });
      setResult(res.data);
      toast.success('Proposal PDF generated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const sendToClient = async () => {
    if (!clientEmail) { toast.error('Enter client email'); return; }
    if (!result) { toast.error('Generate proposal first'); return; }
    setSendLoading(true);
    try {
      const estimateData = {
        material: parseFloat(estimate.material) || 0,
        labor: parseFloat(estimate.labor) || 0,
        subcontractors: parseFloat(estimate.subcontractors) || 0,
        overhead: parseFloat(estimate.overhead) || 0,
        profit: parseFloat(estimate.profit) || 0,
        total,
      };
      await proposalsApi.send(estimateData, {
        ...projectInfo,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      }, clientEmail, clientName);
      toast.success(`Proposal sent to ${clientEmail}`);
    } catch (err) {
      toast.error('Failed to send. Check email settings in .env');
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proposal Generator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter your cost breakdown and Claude AI will generate a professional bid proposal PDF
        </p>
      </div>

      {/* Cost Inputs */}
      <div className="card mb-6">
        <h3 className="section-title">Cost Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { key: 'material', label: 'Material & Equipment', placeholder: '0' },
            { key: 'labor', label: 'Labor', placeholder: '0' },
            { key: 'subcontractors', label: 'Subcontractors', placeholder: '0' },
            { key: 'overhead', label: 'Overhead & Indirect', placeholder: '0' },
            { key: 'profit', label: 'Profit', placeholder: '0' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  className="input pl-7"
                  placeholder={placeholder}
                  value={estimate[key]}
                  onChange={(e) => setEstimate({ ...estimate, [key]: e.target.value })}
                />
              </div>
            </div>
          ))}
          <div className="flex items-end">
            <div className="w-full bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
              <div className="text-xs text-blue-600 font-medium">Total Bid</div>
              <div className="text-lg font-bold text-blue-700">
                ${total.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Info reminder */}
      <div className="card mb-6 bg-gray-50 border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Project Info (from header)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {[
            ['Project', projectInfo.projectName],
            ['Location', projectInfo.location],
            ['Owner', projectInfo.owner],
            ['GC', projectInfo.gc],
            ['Bid Date', projectInfo.bidDate],
            ['Company', projectInfo.companyName],
          ].map(([label, val]) => (
            <div key={label}>
              <span className="text-gray-500 text-xs">{label}: </span>
              <span className="font-medium text-gray-800">{val || <span className="text-gray-300 italic">not set</span>}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={generate}
          disabled={loading || total === 0}
          className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
        >
          {loading ? (
            <><Loader size={18} className="animate-spin" /> Generating with Claude AI...</>
          ) : (
            <><FileText size={18} /> Generate Proposal PDF</>
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <FileText size={20} className="text-green-600" />
            </div>
            <div>
              <div className="font-semibold text-green-800">Proposal Ready</div>
              <div className="text-sm text-green-600">{result.filename}</div>
            </div>
          </div>

          <a
            href={result.downloadUrl}
            download
            className="btn-primary w-full flex items-center justify-center gap-2 mb-4"
          >
            <Download size={16} />
            Download PDF
          </a>

          <div className="border-t border-green-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Email to Client</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label text-xs">Client Name</label>
                <input
                  className="input"
                  placeholder="John Smith"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Client Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="client@company.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={sendToClient}
              disabled={sendLoading || !clientEmail}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {sendLoading ? (
                <><Loader size={14} className="animate-spin" /> Sending...</>
              ) : (
                <><Send size={14} /> Send Proposal to Client</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
