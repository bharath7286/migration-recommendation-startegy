let barChartInstance = null; // To store the chart instance

document.getElementById("serverForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const serverId = document.getElementById("serverId").value.trim();
    const dataDisplay = document.getElementById("dataDisplay");
    const errorDisplay = document.getElementById("error");
    const barChartCanvas = document.getElementById("barChart");

    // Clear previous results
    dataDisplay.style.display = "none";
    dataDisplay.innerHTML = "";
    barChartCanvas.style.display = "none";
    if (errorDisplay) errorDisplay.remove();

    // Validate input
    if (!serverId) {
        alert("Please enter a valid server number.");
        return;
    }

    // Fetch API Data
    const apiUrl = `https://h5kyfx0mh2.execute-api.ap-southeast-2.amazonaws.com/dev/server-data/${serverId}`;
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const serverData = JSON.parse(data.body);

            // Parse software
            let softwareList = [];
            try {
                softwareList = JSON.parse(serverData.server.software);
            } catch (e) {
                console.error("Error parsing software data", e);
            }

            // Parse strategy_scores
            let strategyScores = {};
            try {
                strategyScores = JSON.parse(serverData.server.strategy_scores);
            } catch (e) {
                console.error("Error parsing strategy scores", e);
            }

            // Generate Server Details Display
            dataDisplay.innerHTML = `
                <h3>Server Details</h3>
                <ul>
                    <li><strong>Server Name:</strong> ${serverData.server.server_name}</li>
                    <li><strong>CPU Utilization:</strong> ${serverData.server.cpu_utilization}%</li>
                    <li><strong>Memory Utilization:</strong> ${serverData.server.memory_utilization} MB</li>
                    <li><strong>Storage:</strong> ${serverData.server.storage} GB</li>
                    <li><strong>Network Utilization:</strong> ${serverData.server.network_utilization}%</li>
                    <li><strong>Cost:</strong> $${serverData.server.cost}</li>
                    <li><strong>Instance Type:</strong> ${serverData.server.instance_type || "N/A"}</li>
                    <li><strong>Primary Strategy:</strong> ${serverData.server.primary_strategy}</li>
                    <li><strong>Software:</strong> ${softwareList.length > 0 ? softwareList.join(", ") : "None"}</li>
                </ul>
            `;
            dataDisplay.style.display = "block";

            // Prepare Bar Chart Data
            if (Object.keys(strategyScores).length > 0) {
                const chartLabels = Object.keys(strategyScores).map(label => label.replace('_', ' ').toUpperCase());
                const chartValues = Object.values(strategyScores);

                // Destroy previous chart instance if it exists
                if (barChartInstance) barChartInstance.destroy();

                // Display the bar chart
                barChartCanvas.style.display = "block";
                const ctx = barChartCanvas.getContext("2d");
                barChartInstance = new Chart(ctx, {
                    type: "bar",
                    data: {
                        labels: chartLabels,
                        datasets: [{
                            label: "Strategy Scores",
                            data: chartValues,
                            backgroundColor: "rgba(75, 192, 192, 0.6)",
                            borderColor: "rgba(75, 192, 192, 1)",
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            }
        })
        .catch(error => {
            const errorMessage = document.createElement("div");
            errorMessage.id = "error";
            errorMessage.textContent = `Error fetching data: ${error.message}`;
            document.querySelector(".container").appendChild(errorMessage);
        });
});
