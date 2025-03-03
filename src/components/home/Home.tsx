
const Home = () => {
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">首頁</h1>
            <ul className="list-disc pl-5">
                <li className="mb-2"><a className="text-blue-500 hover:underline" href="/">返回主頁</a></li>
                <li className="mb-2"><a className="text-blue-500 hover:underline" href="/fine-test">測試</a></li>
                <li className="mb-2"><a className="text-blue-500 hover:underline" href="/tutorial">教學</a></li>
                <li className="mb-2"><a className="text-blue-500 hover:underline" href="/volume">Volume Viewer</a></li>
            </ul>
        </div>
    )
}

export default Home