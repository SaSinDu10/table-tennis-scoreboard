import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Typography, Spin, Alert, Space, message } from 'antd';
import axios from 'axios';
import { Routes, Route, useNavigate, useLocation, useMatch } from 'react-router-dom';
import PlayerForm from './components/PlayerForm';
import PlayerList from './components/PlayerList';
import MatchSetupForm from './components/MatchSetupForm';
import MatchList from './components/MatchList';
import Scoreboard from './components/Scoreboard';
import PlayerRankings from './components/PlayerRankings';
import 'antd/dist/reset.css';

const { Header, Content, Footer, Sider } = Layout;
const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
    const [players, setPlayers] = useState([]);
    const [loadingPlayers, setLoadingPlayers] = useState(true);
    const [errorPlayers, setErrorPlayers] = useState(null);
    const [matchListVersion, setMatchListVersion] = useState(0);
    // ------------------------------------------------

    // React Router hooks
    const navigate = useNavigate();
    const location = useLocation();
    const isScoreboardRoute = useMatch("/match/:id/score");

    // Function to fetch players - memoized with useCallback
    const fetchPlayers = useCallback(async () => {
        console.log("Fetching players...");
        setLoadingPlayers(true);
        setErrorPlayers(null);
        try {
            const response = await axios.get(`${API_URL}/api/players`);
            setPlayers(response.data || []);
            console.log("Players fetched successfully:", response.data?.length);
        } catch (err) {
            console.error("Error fetching players:", err.response?.data || err.message || err);
            const errorMsg = err.response?.data?.message || 'Failed to load players.';
            setErrorPlayers(errorMsg);
            setPlayers([]);
            message.error(errorMsg);
        } finally {
            console.log("Setting loadingPlayers to false.");
            setLoadingPlayers(false);
        }
    }, []);

    useEffect(() => {
        if (location.pathname === '/') {
            fetchPlayers();
        }
    }, [fetchPlayers, location.pathname]);

    const handlePlayerAdded = (newPlayer) => {
        setPlayers(prevPlayers =>
            [...prevPlayers, newPlayer].sort((a, b) => a.name.localeCompare(b.name))
        );
        console.log("App detected player added:", newPlayer);
    };

    // --- UPDATED Callback for MatchSetupForm ---
    const handleMatchCreated = (newMatch) => {
        console.log("App detected match created:", newMatch);
        message.success(`Match created successfully!`);
        // --- Increment version state to trigger MatchList remount/refresh ---
        setMatchListVersion(prevVersion => prevVersion + 1);
    };

    // Determine selected menu key based on route
    const getSelectedKey = () => {
        const path = location.pathname;
        if (isScoreboardRoute) return null;
        if (path === '/rankings') return '3';
        if (path === '/setup-match') return '2';
        if (path === '/') return '1';
        return '1';
    };

    // Menu items definition
    const menuItems = [
        { key: '1', label: 'Players' /*, icon: <UserOutlined />*/ },
        { key: '2', label: 'Matches / Setup' /*, icon: <UnorderedListOutlined />*/ },
        { key: '3', label: 'Rankings' /*, icon: <TrophyOutlined />*/ },
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            {/* Conditionally Render Sider (Hide on Scoreboard route) */}
            {!isScoreboardRoute && (
                <Sider breakpoint="lg" collapsedWidth="0">
                    <div style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', color: 'white', lineHeight: '32px', borderRadius: '4px' }}> Menu </div>
                    <Menu
                        theme="dark" mode="inline"
                        selectedKeys={getSelectedKey() ? [getSelectedKey()] : []}
                        onClick={({ key }) => {
                            if (key === '1') navigate('/');
                            else if (key === '2') navigate('/setup-match');
                            else if (key === '3') navigate('/rankings');
                        }}
                        items={menuItems}
                    />
                </Sider>
            )}

            {/* Inner Layout */}
            <Layout>
                <Header style={{ background: '#fff', paddingLeft: '20px', borderBottom: '1px solid #f0f0f0' }}>
                    <Title level={3} style={{ margin: '16px 0', lineHeight: '32px' }}> Table Tennis Tournament Scoreboard </Title>
                </Header>

                {/* Main Content Area */}
                <Content style={{
                    margin: '24px 16px 0',
                    padding: isScoreboardRoute ? 0 : 24,
                    background: '#fff',
                    minHeight: 280,
                }}>
                    {/* --- Routing Setup --- */}
                    <Routes>
                        {/* Player Management Route */}
                        <Route
                            path="/"
                            element={
                                <Space direction="vertical" size="large" style={{ display: 'flex', width: '100%' }}>
                                    <PlayerForm onPlayerAdded={handlePlayerAdded} />
                                    {/* Render PLAYER list, passing correct props */}
                                    <PlayerList
                                        players={players}
                                        loading={loadingPlayers}
                                        error={errorPlayers}
                                        title="All Players"
                                    />
                                </Space>
                            }
                        />
                        {/* Match Setup & Lists Route */}
                        <Route
                            path="/setup-match"
                            element={
                                <Space direction="vertical" size="large" style={{ display: 'flex', width: '100%' }}>
                                    <MatchSetupForm onMatchCreated={handleMatchCreated} />
                                    {/* Render MATCH lists, passing key for refresh */}
                                    {/* The key prop forces remount when matchListVersion changes */}
                                    <MatchList key={`upcoming-${matchListVersion}`} status="Upcoming" title="Upcoming Matches" />
                                    <MatchList key={`live-${matchListVersion}`} status="Live" title="Live Matches" />
                                    <MatchList key={`finished-${matchListVersion}`} status="Finished" title="Finished Matches" />
                                </Space>
                            }
                        />
                        {/* Scoreboard Route */}
                        <Route path="/match/:id/score" element={<Scoreboard />} />
                        <Route path="/rankings" element={<PlayerRankings />} />
                        {/* Optional: Catch-all 404 Route */}
                        {/* <Route path="*" element={<div>404 Page Not Found</div>} /> */}
                    </Routes>
                    {/* ------------------- */}
                </Content>

                <Footer style={{ textAlign: 'center', background: '#f0f2f5', padding: '15px 50px' }}>
                    Scoreboard App ©{new Date().getFullYear()}
                </Footer>
            </Layout>
        </Layout>
    );
}

export default App;