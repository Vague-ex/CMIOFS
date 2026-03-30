import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'
import { CheckCircle, AlertCircle, Loader } from 'lucide-react'

export default function POConfirmPage() {
    const { poId } = useParams()
    const [status, setStatus] = useState('loading')
    const [message, setMessage] = useState('')
    const [poNumber, setPONumber] = useState('')

    useEffect(() => {
        if (!poId) {
            setStatus('error')
            setMessage('Invalid PO ID.')
            return
        }

        const confirmReceipt = async () => {
            try {
                const res = await client.post(`/purchase-orders/${poId}/confirm/`)
                setPONumber(res.data.po_number)
                setMessage(res.data.message)
                setStatus('success')
            } catch (err) {
                setMessage(
                    err?.response?.data?.error ||
                    'Failed to confirm receipt. Please try again or contact us.'
                )
                setStatus('error')
            }
        }

        confirmReceipt()
    }, [poId])

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
                {status === 'loading' && (
                    <>
                        <Loader size={48} className="mx-auto text-blue-600 animate-spin mb-4" />
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">Processing...</h1>
                        <p className="text-gray-600">Confirming your receipt...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
                        <h1 className="text-2xl font-bold text-green-700 mb-2">Confirmed!</h1>
                        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                            <p className="text-green-800 font-semibold mb-2">{message}</p>
                            {poNumber && (
                                <p className="text-sm text-green-700">
                                    <strong>PO Number:</strong> {poNumber}
                                </p>
                            )}
                        </div>
                        <p className="text-gray-600 text-sm">
                            Your confirmation has been recorded in our system.
                        </p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <AlertCircle size={48} className="mx-auto text-red-600 mb-4" />
                        <h1 className="text-2xl font-bold text-red-700 mb-2">Error</h1>
                        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                            <p className="text-red-800">{message}</p>
                        </div>
                        <p className="text-gray-600 text-sm">
                            If you continue to experience issues, please contact support.
                        </p>
                    </>
                )}

                <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                        CMIOFS System
                    </p>
                </div>
            </div>
        </div>
    )
}
