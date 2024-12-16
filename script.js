let costChartInstance = null;
let strategyChartInstance = null;

document.getElementById("serverForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const serverId = document.getElementById("serverId").value.trim();
    const dataDisplay = document.getElementById("dataDisplay");

    // Clear previous data and charts
    dataDisplay.innerHTML = "";
    if (costChartInstance) {
        costChartInstance.destroy();
        costChartInstance = null;
    }
    if (strategyChartInstance) {
        strategyChartInstance.destroy();
        strategyChartInstance = null;
    }

    // Validate input
    if (!serverId) {
        alert("Please enter a valid server number.");
        return;
    }

    // Fetch data from API
    const apiUrl = `https://h5kyfx0mh2.execute-api.ap-southeast-2.amazonaws.com/dev/server-data/${serverId}`;
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const serverData = JSON.parse(data.body);

            // Display Server Details
            dataDisplay.innerHTML = `
                <h3>Server Details</h3>
                <ul>
                    <li><strong>Server Name:</strong> ${serverData.server.server_name}</li>
                    <li><strong>CPU Utilization:</strong> ${serverData.server.cpu_utilization}%</li>
                    <li><strong>Memory Utilization:</strong> ${serverData.server.memory_utilization} MB</li>
                    <li><strong>Storage:</strong> ${serverData.server.storage} GB</li>
                    <li><strong>Software Dependencies:</strong> ${serverData.server.software || "None"}</li>
                </ul>
            `;

            // Display Cost Graph
            const costCanvas = document.getElementById("costGraph");
            costCanvas.style.display = "block";
            const costCtx = costCanvas.getContext("2d");
            costChartInstance = new Chart(costCtx, {
                type: "bar",
                data: {
                    labels: ["Cost"],
                    datasets: [{
                        label: "Cost ($)",
                        data: [serverData.server.cost],
                        backgroundColor: "rgba(197, 87, 153, 0.6)",
                        borderColor: "rgb(235, 54, 54)",
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });

            // Display Migration Strategy Graph
            const strategyCanvas = document.getElementById("strategyGraph");
            strategyCanvas.style.display = "block";
            const strategyCtx = strategyCanvas.getContext("2d");
            const strategyScores = JSON.parse(serverData.server.strategy_scores || "{}");
            strategyChartInstance = new Chart(strategyCtx, {
                type: "bar",
                data: {
                    labels: Object.keys(strategyScores),
                    datasets: [{
                        label: "Migration Strategy Scores",
                        data: Object.values(strategyScores),
                        backgroundColor: "rgba(112, 183, 241, 0.6)",
                        borderColor: "rgb(122, 34, 246)",
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true } }
                }
            });

            // Display Cost Value and Migration Strategy
            const costLabel = document.getElementById("costLabel");
            costLabel.innerHTML = `<strong>Cost Value:</strong> $${serverData.server.cost}`;

            const strategyLabel = document.getElementById("strategyLabel");
            const highestStrategy = Object.keys(strategyScores).reduce((a, b) =>
                strategyScores[a] > strategyScores[b] ? a : b
            );
            strategyLabel.innerHTML = `<strong>Primary Migration Strategy:</strong> ${highestStrategy}`;

            // Summary Section
            const summaryMessage = document.getElementById("summaryMessage");
            summaryMessage.innerHTML = `
                <p>Based on the analysis, we recommend a primary migration strategy of <strong>${highestStrategy}</strong> with an estimated cost of <strong>$${serverData.server.cost}</strong>.</p>
            `;
        })
        .catch(error => {
            dataDisplay.innerHTML = `<div style="color: red;">Error fetching data: ${error.message}</div>`;
        });
});
